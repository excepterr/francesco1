const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const supabase = require('./supabase');

const CATEGORIES = ['messages', 'members', 'voice', 'channels', 'roles', 'moderation', 'economy'];


const EVENT_TO_CATEGORY = {
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
    economy_tx: 'economy',   // ← новое
};

async function getRawSettings(guildId) {
    const { data } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();
    return data;
}

async function getLoggingSettings(guildId) {
    const data = await getRawSettings(guildId);
    return {
        enabled: data?.logging_enabled ?? false,
        channelId: data?.logging_channel_id ?? null,
        events: data?.logging_events ?? {},
    };
}

async function saveSettings(guildId, patch) {
    const existing = await getRawSettings(guildId);
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
    if (error) console.error('saveSettings error:', error);
    return merged;
}

async function setLoggingEnabled(guildId, enabled) {
    return saveSettings(guildId, { logging_enabled: enabled });
}

async function setLoggingChannel(guildId, channelId) {
    return saveSettings(guildId, { logging_channel_id: channelId });
}

async function toggleCategory(guildId, category) {
    const cfg = await getLoggingSettings(guildId);
    const events = { ...cfg.events };
    const currently = events[category] !== false;
    events[category] = !currently;
    await saveSettings(guildId, { logging_events: events });
    return { category, enabled: !currently };
}

function isCategoryEnabled(events, category) {
    return events[category] !== false;
}

/**
 * payload: { embeds: [...] }  — старый стиль
 *          { components: [...], flags }  — новый V2 стиль
 *          { content: '...' }
 */
async function sendLogEvent(client, guild, eventKey, payload) {
    const category = EVENT_TO_CATEGORY[eventKey];
    if (!category) return;

    try {
        const cfg = await getLoggingSettings(guild.id);
        if (!cfg.enabled) return;
        if (!cfg.channelId) return;
        if (!isCategoryEnabled(cfg.events, category)) return;

        const channel = guild.channels.cache.get(cfg.channelId)
            ?? await guild.channels.fetch(cfg.channelId).catch(() => null);
        if (!channel) return;

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
        console.error('sendLogEvent error:', err);
    }
}

module.exports = {
    CATEGORIES,
    EVENT_TO_CATEGORY,
    getLoggingSettings,
    saveSettings,
    setLoggingEnabled,
    setLoggingChannel,
    toggleCategory,
    isCategoryEnabled,
    sendLogEvent,
};