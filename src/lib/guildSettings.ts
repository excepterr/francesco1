import { supabase } from './supabase';

export interface GuildSettings {
    guild_id: string;
    language: string;
    disabled_modules: string[];
    birthday_enabled: boolean;
    birthday_channel_id: string | null;
    logging_enabled: boolean;
    logging_channel_id: string | null;
    logging_events: Record<string, boolean>;
    currency_emoji: string;
    currency_name: string;
}

// ─── In-memory кэш ───
const CACHE_TTL = 60_000;
const cache = new Map<string, { data: GuildSettings; ts: number }>();

export function invalidateSettingsCache(guildId: string): void {
    cache.delete(guildId);
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
    const cached = cache.get(guildId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }

    const { data, error } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

    if (error) console.error('[DB] getGuildSettings:', error.message);

    let result: GuildSettings;

    if (!data) {
        const defaults: GuildSettings = {
            guild_id: guildId,
            language: 'en',
            disabled_modules: [],
            birthday_enabled: false,
            birthday_channel_id: null,
            logging_enabled: false,
            logging_channel_id: null,
            logging_events: {},
            currency_emoji: '💎',
            currency_name: 'Валюта',
        };
        await supabase.from('guild_settings').insert(defaults);
        result = defaults;
    } else {
        result = data as GuildSettings;
    }

    cache.set(guildId, { data: result, ts: Date.now() });
    return result;
}

export async function updateGuildLanguage(
    guildId: string,
    language: string,
): Promise<void> {
    await getGuildSettings(guildId);
    const { error } = await supabase
        .from('guild_settings')
        .update({ language, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId);
    if (error) console.error('[DB] updateGuildLanguage:', error.message);
    invalidateSettingsCache(guildId);
}

export async function updateGuildModules(
    guildId: string,
    disabledModules: string[],
): Promise<void> {
    await getGuildSettings(guildId);
    const { error } = await supabase
        .from('guild_settings')
        .update({
            disabled_modules: disabledModules,
            updated_at: new Date().toISOString(),
        })
        .eq('guild_id', guildId);
    if (error) console.error('[DB] updateGuildModules:', error.message);
    invalidateSettingsCache(guildId);
}

export async function updateBirthdaySettings(
    guildId: string,
    enabled: boolean,
    channelId: string | null,
): Promise<boolean> {
    await getGuildSettings(guildId);
    const { error } = await supabase
        .from('guild_settings')
        .update({
            birthday_enabled: enabled,
            birthday_channel_id: channelId,
            updated_at: new Date().toISOString(),
        })
        .eq('guild_id', guildId);

    if (error) {
        console.error('[DB] updateBirthdaySettings:', error.message);
        return false;
    }
    invalidateSettingsCache(guildId);
    return true;
}

export async function getEnabledBirthdayGuilds(): Promise<GuildSettings[]> {
    const { data, error } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('birthday_enabled', true);

    if (error) {
        console.error('[DB] getEnabledBirthdayGuilds:', error.message);
        return [];
    }
    return (data ?? []) as GuildSettings[];
}