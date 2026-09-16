const {
    ContainerBuilder, TextDisplayBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const conf = require('./confessions');
const { askAI } = require('./ai');

// ───── антиспам ─────
const SPAM_WINDOW_MS = 60_000;         // окно 1 минута
const SPAM_MAX_PER_WINDOW = 5;          // максимум 5 пингов в минуту
const SPAM_MUTE_MS = 5 * 60_000;        // мьют 5 минут при превышении

const userHistory = new Map();          // userId -> [timestamps]
const userMutedUntil = new Map();       // userId -> timestamp
const warnedUsers = new Set();          // кому уже сказали про мьют

function checkSpam(userId) {
    const now = Date.now();

    // в муте
    const mutedUntil = userMutedUntil.get(userId) ?? 0;
    if (now < mutedUntil) {
        return { blocked: true, muted: true, alreadyWarned: warnedUsers.has(userId) };
    }

    // снимаем мьют (время прошло)
    if (mutedUntil && now >= mutedUntil) {
        userMutedUntil.delete(userId);
        warnedUsers.delete(userId);
    }

    // скользящее окно
    const history = (userHistory.get(userId) ?? []).filter(t => now - t < SPAM_WINDOW_MS);
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

// периодическая очистка, чтобы не копились мёртвые данные
setInterval(() => {
    const now = Date.now();
    for (const [userId, times] of userHistory.entries()) {
        const fresh = times.filter(t => now - t < SPAM_WINDOW_MS);
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

// ───── контейнер + кнопки ─────
function buildReplyContainer(reply, userId, disabled = false) {
    const container = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(reply),
        );

    const actions = new ActionRowBuilder().addComponents(
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

    return { container, actions };
}

// ───── основной обработчик ─────
async function handleAiMention(client, message) {
    console.log('[ai] старт');

    const guildId = message.guildId;
    const channelId = message.channelId;
    const user = message.author;

    const spam = checkSpam(user.id);
    console.log('[ai] антиспам:', spam);
    if (spam.blocked) {
        if (!spam.muted && !spam.alreadyWarned) {
            await message.reply({
                content: 'эй, полегче. я не успеваю. дай мне пару минут.',
                allowedMentions: { repliedUser: false },
            }).catch(() => {});
        }
        return;
    }

    const container = await conf.getContainerByChannel(guildId, channelId);
    console.log('[ai] контейнер:', container ? container.id : 'НЕ НАЙДЕН');
    if (!container) return;

    const cleanContent = message.content
        .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
        .trim();

    console.log('[ai] текст без пинга:', JSON.stringify(cleanContent));

    if (!cleanContent) {
        await message.reply({
            content: 'ну что?',
            allowedMentions: { repliedUser: false },
        }).catch(() => {});
        return;
    }

    await conf.updateUsername(guildId, container.id, user.id, user.username);

    const data = await conf.readContainer(guildId, container.id);
    if (!data) return;

    const memory = data.memory ?? {};
    const recent = Array.isArray(data.recent) ? data.recent : [];

    const messages = recent.map(m => {
        if (m.role === 'user') {
            return { role: 'user', content: `${m.username ?? 'user'}: ${m.content}` };
        }
        return { role: 'assistant', content: m.content };
    });

    messages.push({ role: 'user', content: `${user.username}: ${cleanContent}` });

    await message.channel.sendTyping().catch(() => {});
    console.log('[ai] отправляю запрос в Groq...');
    

    const reply = await askAI({
        messages,
        memory,
        userId: user.id,
        botName: client.user.username,
        onSaveFact: async (fact) => {
            await conf.saveFact(guildId, container.id, user.id, user.username, fact);
        },
    });

    console.log('[ai] ответ от Groq:', reply ? reply.slice(0, 80) : 'ПУСТО');

    if (reply === '__RATE_LIMIT__') {
        await message.reply({
            content: 'у меня закончились бесплатные запросы на сегодня. попробуй позже!',
            allowedMentions: { repliedUser: false },
        }).catch(() => {});
        return;
    }

    if (!reply) {
        await message.reply({
            content: '...',
            allowedMentions: { repliedUser: false },
        }).catch(() => {});
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

    const { container: replyContainer, actions } = buildReplyContainer(reply, user.id);

    const sent = await message.reply({
        components: [replyContainer, actions],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    }).catch(() => null);

    if (sent) {
        client.regenData.set(sent.id, {
            messages,
            memory,
            userId: user.id,
            username: user.username,
            botName: client.user.username,
            containerId: container.id,
            guildId,
            attempts: 0,
            ownerId: user.id,
        });
    }
}

module.exports = { handleAiMention, buildReplyContainer };