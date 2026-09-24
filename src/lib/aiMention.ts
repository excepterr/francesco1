import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Message,
} from 'discord.js';
import { MyClient } from '../client';
import { askAI } from './ai';
import * as conf from './confessions';

// ───── антиспам ─────
const SPAM_WINDOW_MS = 60_000;
const SPAM_MAX_PER_WINDOW = 5;
const SPAM_MUTE_MS = 5 * 60_000;

const userHistory = new Map<string, number[]>();
const userMutedUntil = new Map<string, number>();
const warnedUsers = new Set<string>();

function checkSpam(userId: string): {
    blocked: boolean;
    muted?: boolean;
    alreadyWarned?: boolean;
} {
    const now = Date.now();

    const mutedUntil = userMutedUntil.get(userId) ?? 0;
    if (now < mutedUntil) {
        return { blocked: true, muted: true, alreadyWarned: warnedUsers.has(userId) };
    }

    if (mutedUntil && now >= mutedUntil) {
        userMutedUntil.delete(userId);
        warnedUsers.delete(userId);
    }

    const history = (userHistory.get(userId) ?? []).filter(
        (t) => now - t < SPAM_WINDOW_MS,
    );
    history.push(now);
    userHistory.set(userId, history);

    if (history.length > SPAM_MAX_PER_WINDOW) {
        userMutedUntil.set(userId, now + SPAM_MUTE_MS);
        const alreadyWarned = warnedUsers.has(userId);
        warnedUsers.add(userId);
        return { blocked: true, muted: false, alreadyWarned };
    }

    return { blocked: false };
}

setInterval(() => {
    const now = Date.now();
    for (const [userId, times] of userHistory.entries()) {
        const fresh = times.filter((t) => now - t < SPAM_WINDOW_MS);
        if (fresh.length === 0) userHistory.delete(userId);
        else userHistory.set(userId, fresh);
    }
    for (const [userId, until] of userMutedUntil.entries()) {
        if (now >= until) {
            userMutedUntil.delete(userId);
            warnedUsers.delete(userId);
        }
    }
}, 60_000).unref();

// ───── кнопки под ответом ─────
export function buildReplyActions(
    userId: string,
    disabled = false,
): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`conf_regen:${userId}`)
            .setLabel('Regenerate')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`conf_report_msg:${userId}`)
            .setLabel('Report')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
    );
}

// ───── основной обработчик ─────
export async function handleAiMention(client: MyClient, message: Message) {
    const guildId = message.guildId;
    const channelId = message.channelId;
    const user = message.author;
    if (!guildId) return;

    const spam = checkSpam(user.id);
    if (spam.blocked) {
        if (!spam.muted && !spam.alreadyWarned) {
            await message
                .reply({
                    content: 'эй, полегче. я не успеваю. дай мне пару минут.',
                    allowedMentions: { repliedUser: false },
                })
                .catch(() => {});
        }
        return;
    }

    const container = await conf.getContainerByChannel(guildId, channelId);
    if (!container) return;

    const cleanContent = message.content
        .replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '')
        .trim();

    if (!cleanContent) {
        await message
            .reply({
                content: 'ну что?',
                allowedMentions: { repliedUser: false },
            })
            .catch(() => {});
        return;
    }

    await conf.updateUsername(guildId, container.id, user.id, user.username);

    const data = await conf.readContainer(guildId, container.id);
    if (!data) return;

    const memory = data.memory ?? {};
    const recent = Array.isArray(data.recent) ? data.recent : [];

    const messages = recent.map((m) => {
        if (m.role === 'user') {
            return {
                role: 'user' as const,
                content: `${m.username ?? 'user'}: ${m.content}`,
            };
        }
        return { role: 'assistant' as const, content: m.content };
    });

    messages.push({
        role: 'user' as const,
        content: `${user.username}: ${cleanContent}`,
    });

    if ('sendTyping' in message.channel) {
        await message.channel.sendTyping().catch(() => {});
    }

    const reply = await askAI({
        messages,
        memory,
        userId: user.id,
        botName: client.user!.username,
        onSaveFact: async (fact) => {
            await conf.saveFact(guildId, container.id, user.id, user.username, fact);
        },
    });

    if (reply === '__RATE_LIMIT__') {
        await message
            .reply({
                content: 'у меня закончились бесплатные запросы на сегодня. попробуй позже!',
                allowedMentions: { repliedUser: false },
            })
            .catch(() => {});
        return;
    }
    if (!reply) {
        await message
            .reply({ content: '...', allowedMentions: { repliedUser: false } })
            .catch(() => {});
        return;
    }

    await conf.pushRecent(guildId, container.id, {
        role: 'user',
        user_id: user.id,
        username: user.username,
        content: cleanContent,
        ts: Date.now(),
    });
    await conf.pushRecent(guildId, container.id, {
        role: 'assistant',
        content: reply,
        ts: Date.now(),
    });

    const actions = buildReplyActions(user.id);

    const sent = await message
        .reply({
            content: reply,
            components: [actions],
            allowedMentions: { repliedUser: false },
        })
        .catch(() => null);

    if (sent) {
        client.regenData.set(sent.id, {
            messages,
            memory,
            userId: user.id,
            username: user.username,
            botName: client.user!.username,
            containerId: container.id,
            guildId,
            attempts: 0,
            ownerId: user.id,
        });
    }
}