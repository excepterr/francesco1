import { EmbedBuilder, User } from 'discord.js';
import { t } from './i18n';

// Серый цвет Discord
const GREY = 0x99aab5;

/**
 * Embed без цветной полосы слева.
 * Полоса появляется только если вызвать .setColor().
 */
function baseEmbed(): EmbedBuilder {
    return new EmbedBuilder().setTimestamp();
}

export function createErrorEmbed(
    action: string,
    user: User,
    description: string,
): EmbedBuilder {
    return baseEmbed()
        .setTitle(`${action} — ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(description);
    // .setColor() НЕ вызываем — полосы не будет
}

export function createInfoEmbed(
    title: string,
    user: User,
    description?: string,
): EmbedBuilder {
    const embed = baseEmbed()
        .setTitle(title)
        .setThumbnail(user.displayAvatarURL());
    if (description) embed.setDescription(description);
    return embed;
}

export function createGreyEmbed(title: string, user: User): EmbedBuilder {
    return baseEmbed()
        .setTitle(title)
        .setThumbnail(user.displayAvatarURL())
        .setColor(GREY);
}

export const MOD_ICON_URL =
    'https://cdn.discordapp.com/emojis/000000000000000000.png';

interface ModActionParams {
    lang: string;
    moderatorId: string;
    targetUsername: string;
    targetAvatarUrl: string;   // 👈 NEW
    actionKey: string;
    reason?: string | null;
    extra?: Record<string, string>;
}

export function createModActionEmbed(params: ModActionParams): EmbedBuilder {
    const { lang, moderatorId, targetUsername, targetAvatarUrl, actionKey, reason, extra } = params;

    const title = t(lang, 'moderation.actionTitle', { user: targetUsername });
    const actionText = t(lang, `moderation.action${actionKey}`, extra ?? {});
    const description = t(lang, 'moderation.actionDescription', {
        moderator: `<@${moderatorId}>`,
        user: targetUsername,
        action: actionText,
    });
    const reasonLabel = t(lang, 'moderation.reasonLabel');
    const reasonValue = reason?.trim() || t(lang, 'moderation.reasonNone');

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n> ${reasonLabel}: ${reasonValue}`)
        .setThumbnail(targetAvatarUrl)   // 👈 аватар цели
        .setTimestamp();
}

interface ModSimpleParams {
    lang: string;
    moderatorId: string;
    moderatorAvatarUrl: string;   // 👈 NEW
    titleKey: string;
    descriptionKey: string;
    vars: Record<string, string>;
    reason?: string | null;
}

export function createModSimpleEmbed(params: ModSimpleParams): EmbedBuilder {
    const { lang, moderatorId, moderatorAvatarUrl, titleKey, descriptionKey, vars, reason } = params;

    const title = t(lang, titleKey, vars);
    const description = t(lang, descriptionKey, {
        moderator: `<@${moderatorId}>`,
        ...vars,
    });
    const reasonLabel = t(lang, 'moderation.reasonLabel');
    const reasonValue = reason?.trim() || t(lang, 'moderation.reasonNone');

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n> ${reasonLabel}: ${reasonValue}`)
        .setThumbnail(moderatorAvatarUrl)   // 👈 аватар модератора
        .setTimestamp();
}