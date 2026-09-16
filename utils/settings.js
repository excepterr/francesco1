const supabase = require('./supabase');

const DEFAULTS = { lang: 'ru', prefix: '!' };
const cache = new Map();

async function getSettings(guildId) {
    if (cache.has(guildId)) return cache.get(guildId);
    const { data } = await supabase
        .from('guild_settings')
        .select('lang, prefix')
        .eq('guild_id', guildId)
        .maybeSingle();
    const settings = data ?? DEFAULTS;
    cache.set(guildId, settings);
    return settings;
}

async function getFullSettings(guildId) {
    const { data } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();
    return data;
}

async function updateSettings(guildId, patch) {
    const existing = await getFullSettings(guildId);
    const merged = {
        guild_id: guildId,
        lang: existing?.lang ?? 'ru',
        prefix: existing?.prefix ?? '!',
        modlog_channel_id: existing?.modlog_channel_id ?? null,
        logging_enabled: existing?.logging_enabled ?? false,
        logging_channel_id: existing?.logging_channel_id ?? null,
        logging_events: existing?.logging_events ?? {},
        disabled_categories: existing?.disabled_categories ?? [],
        ...patch,
    };
    const { error } = await supabase
        .from('guild_settings')
        .upsert(merged, { onConflict: 'guild_id' });
    if (error) console.error('updateSettings error:', error);
    cache.set(guildId, { lang: merged.lang, prefix: merged.prefix });
    return merged;
}

async function getDisabledCategories(guildId) {
    const { data } = await supabase
        .from('guild_settings')
        .select('disabled_categories')
        .eq('guild_id', guildId)
        .maybeSingle();
    return data?.disabled_categories ?? [];
}

async function toggleCategory(guildId, category) {
    const list = await getDisabledCategories(guildId);
    const set = new Set(list);
    if (set.has(category)) set.delete(category);
    else set.add(category);
    const arr = Array.from(set);
    await updateSettings(guildId, { disabled_categories: arr });
    return arr;
}

module.exports = {
    getSettings,
    getFullSettings,
    updateSettings,
    getDisabledCategories,
    toggleCategory,
};