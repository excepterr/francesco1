import { GuildMember, Guild, User } from 'discord.js';
import { UserError } from './errors';
import { t } from './i18n';

/** Может ли `actor` модерировать `target` (по иерархии ролей) */
export function canModerate(
    actor: GuildMember,
    target: GuildMember,
    guild: Guild,
): boolean {
    if (actor.id === guild.ownerId) return true;
    if (target.id === guild.ownerId) return false;
    return actor.roles.highest.position > target.roles.highest.position;
}

/** Может ли бот модерировать цель */
export function botCanModerate(
    botMember: GuildMember,
    target: GuildMember,
    guild: Guild,
): boolean {
    if (target.id === guild.ownerId) return false;
    return botMember.roles.highest.position > target.roles.highest.position;
}

/** Парсит "5m", "1h", "2d" → миллисекунды. null если неверный формат. */
export function parseDuration(input: string): number | null {
    const m = input.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!m) return null;
    const n = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const map: Record<string, number> = {
        s: 1000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
    };
    return n * map[unit];
}

/** Проверяет иерархию, кидает UserError при нарушении */
export function assertCanModerate(
    actor: GuildMember,
    target: GuildMember,
    guild: Guild,
    botMember: GuildMember,
    lang: string,
): void {
    if (target.id === actor.id) {
        throw new UserError(t(lang, 'moderation.cantSelf'));
    }
    if (!canModerate(actor, target, guild)) {
        throw new UserError(t(lang, 'moderation.hierarchyUser'));
    }
    if (!botCanModerate(botMember, target, guild)) {
        throw new UserError(t(lang, 'moderation.hierarchyBot'));
    }
}