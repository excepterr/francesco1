// src/commands/Interactions/actions.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';

const NEKOS_URL = 'https://nekos.best/api/v2';

interface ActionMeta {
    target: boolean;
    selfAllowed: boolean; // 👈 можно ли применить на себя
    label: string;
}

const ACTIONS: Record<string, ActionMeta> = {
    // Парные — себя нельзя
    hug:      { target: true,  selfAllowed: false, label: 'Hug' },
    kiss:     { target: true,  selfAllowed: false, label: 'Kiss' },
    cuddle:   { target: true,  selfAllowed: false, label: 'Cuddle' },
    handhold: { target: true,  selfAllowed: false, label: 'Handhold' },
    highfive: { target: true,  selfAllowed: false, label: 'High five' },
    tickle:   { target: true,  selfAllowed: false, label: 'Tickle' },
    pat:      { target: true,  selfAllowed: false, label: 'Pat' },

    // Агрессивные — себя тоже нельзя
    slap:     { target: true,  selfAllowed: false, label: 'Slap' },
    punch:    { target: true,  selfAllowed: false, label: 'Punch' },
    bite:     { target: true,  selfAllowed: false, label: 'Bite' },

    // Забавные — себя можно
    poke:     { target: true,  selfAllowed: false,  label: 'Poke' },
    feed:     { target: true,  selfAllowed: false,  label: 'Feed' },

    // Без цели
    cry:      { target: false, selfAllowed: true,  label: 'Cry' },
    laugh:    { target: false, selfAllowed: true,  label: 'Laugh' },
    dance:    { target: false, selfAllowed: true,  label: 'Dance' },
    wave:     { target: false, selfAllowed: true,  label: 'Wave' },
    blush:    { target: false, selfAllowed: true,  label: 'Blush' },
    smile:    { target: false, selfAllowed: true,  label: 'Smile' },
    wink:     { target: false, selfAllowed: true,  label: 'Wink' },
    facepalm: { target: false, selfAllowed: true,  label: 'Facepalm' },
    thumbsup: { target: false, selfAllowed: true,  label: 'Thumbs up' },
    smug:     { target: false, selfAllowed: true,  label: 'Smug' },
};

async function fetchGif(action: string): Promise<string | null> {
    try {
        const res = await fetch(`${NEKOS_URL}/${action}?amount=1`, {
            headers: { 'User-Agent': 'DiscordBot/1.0' },
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        return data.results?.[0]?.url ?? null;
    } catch {
        return null;
    }
}

function renderText(tpl: string, userId: string, targetId?: string): string {
    return tpl
        .replace(/\{user\}/g, `<@${userId}>`)
        .replace(/\{target\}/g, targetId ? `<@${targetId}>` : '');
}

export default {
    data: new SlashCommandBuilder()
        .setName('actions')
        .setDescription('Interactions and emotions with GIFs.')
        .setDescriptionLocalizations(getLocalizations('actions.description'))
        .addStringOption((opt) =>
            opt
                .setName('action')
                .setDescription('What to do.')
                .setDescriptionLocalizations(getLocalizations('actions.actionOption'))
                .setRequired(true)
                .addChoices(
                    ...Object.entries(ACTIONS).map(([value, meta]) => ({
                        name: meta.label,
                        value,
                        name_localizations: getLocalizations(`actions.labels.${value}`),
                    })),
                ),
        )
        .addUserOption((opt) =>
            opt
                .setName('user')
                .setDescription('The target user.')
                .setDescriptionLocalizations(getLocalizations('actions.userOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const user = interaction.user;

        const actionKey = interaction.options.getString('action', true);
        const meta = ACTIONS[actionKey];
        if (!meta) throw new UserError(t(lang, 'actions.unknown'));

        const target = interaction.options.getUser('user');

        // Если действие требует цель — проверяем
        if (meta.target && !target) {
            throw new UserError(t(lang, 'actions.targetRequired'));
        }

        // 👇 Новое: нельзя таргетить самого себя
        if (target && target.id === user.id && !meta.selfAllowed) {
            throw new UserError(t(lang, 'actions.selfNotAllowed'));
        }

        // Собираем ключ шаблона: self или other
        const tplKey = meta.target
            ? `actions.list.${actionKey}.other`
            : `actions.list.${actionKey}.self`;
        const tpl = t(lang, tplKey);

        if (!tpl || tpl === tplKey) {
            throw new UserError(t(lang, 'actions.unknown'));
        }

        const description = renderText(tpl, user.id, target?.id);
        const gifURL = await fetchGif(actionKey);

        const embed = new EmbedBuilder().setDescription(description);
        if (gifURL) {
            embed.setImage(gifURL);
        } else {
            embed.setFooter({ text: t(lang, 'actions.noGif') });
        }

        await interaction.editReply({
            embeds: [embed],
            allowedMentions: {
                parse: [],
                users: [...new Set([user.id, ...(target ? [target.id] : [])])],
            },
        });
    },
};