import {
    Guild,
    PermissionFlagsBits,
    MessageFlags,
    TextChannel,
} from 'discord.js';
import { MyClient } from '../client';
import { supabase } from './supabase';

export const LOG_CATEGORIES = [
    'messages', 'members', 'voice', 'channels', 'roles', 'moderation', 'economy',
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const EVENT_TO_CATEGORY: Record<string, LogCategory> = {
    message_delete: 'messages',
    message_edit: 'messages',
    message_bulk_delete: 'messages',
    member_join: 'members',
    member_leave: 'members',
    member_ban: 'members',
    member_unban: 'members',
    voice_join: 'voice',
    voice_leave: 'voice',
    voice_move: 'voice',
    channel_create: 'channels',
    channel_delete: 'channels',
    role_create: 'roles',
    role_delete: 'roles',
    mod_action: 'moderation',
    economy_tx: 'economy',
};

export interface LoggingSettings {
    enabled: boolean;
    channelId: string | null;
    events: Record<string, boolean>;
}

async function getRawSettings(guildId: string) {
    const { data } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();
    return data;
}

export async function getLoggingSettings(guildId: string): Promise<LoggingSettings> {
    const data = await getRawSettings(guildId);
    return {
        enabled: data?.logging_enabled ?? false,
        channelId: data?.logging_channel_id ?? null,
        events: data?.logging_events ?? {},
    };
}

export async function updateLoggingSettings(
    guildId: string,
    patch: Partial<{
        enabled: boolean;
        channelId: string | null;
        events: Record<string, boolean>;
    }>,
): Promise<boolean> {
    const existing = await getRawSettings(guildId);

    const merged = {
        guild_id: guildId,
        logging_enabled: patch.enabled ?? existing?.logging_enabled ?? false,
        logging_channel_id:
            patch.channelId ?? existing?.logging_channel_id ?? null,
        logging_events: patch.events ?? existing?.logging_events ?? {},
        updated_at: new Date().toISOString(),
    };

    if (!existing) {
        await supabase.from('guild_settings').insert({
            guild_id: guildId,
            language: 'en',
            disabled_modules: [],
            birthday_enabled: false,
            birthday_channel_id: null,
            ...merged,
        });
        return true;
    }

    const { error } = await supabase
        .from('guild_settings')
        .update(merged)
        .eq('guild_id', guildId);

    if (error) {
        console.error('[DB] updateLoggingSettings:', error.message);
        return false;
    }
    return true;
}

export function isCategoryEnabled(
    events: Record<string, boolean>,
    category: LogCategory,
): boolean {
    return events[category] !== false;
}

export async function sendLogEvent(
    client: MyClient,
    guild: Guild,
    eventKey: string,
    payload: any,
): Promise<void> {
    const category = EVENT_TO_CATEGORY[eventKey];
    if (!category) return;

    try {
        const cfg = await getLoggingSettings(guild.id);

        console.log(
            `[LOG] ${eventKey} | enabled=${cfg.enabled} channel=${cfg.channelId} cat=${category} catEnabled=${isCategoryEnabled(cfg.events, category)}`,
        );

        if (!cfg.enabled) return;
        if (!cfg.channelId) return;
        if (!isCategoryEnabled(cfg.events, category)) return;

        const channel =
            guild.channels.cache.get(cfg.channelId) ??
            (await guild.channels.fetch(cfg.channelId).catch(() => null));
        if (!channel || !(channel instanceof TextChannel)) return;

        const me = guild.members.me;
        const perms = me?.permissionsIn(channel);
        if (!perms?.has(PermissionFlagsBits.SendMessages)) return;
        if (!perms?.has(PermissionFlagsBits.EmbedLinks)) return;

        const out = { ...payload };
        if (out.components) {
            out.flags = (out.flags || 0) | MessageFlags.IsComponentsV2;
        }

        await channel.send(out).catch(() => {});
    } catch (err) {
        console.error('[LOG] sendLogEvent error:', err);
    }
}