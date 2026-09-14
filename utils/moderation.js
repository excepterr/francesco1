const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('./supabase');

const MOD_COLORS = {
    ban:         0xED4245,
    unban:       0x57F287,
    unbanall:    0x57F287,
    kick:        0xED4245,
    softban:     0xED4245,
    timeout:     0xED4245,
    untimeout:   0x57F287,
    warn:        0xFEE75C,
    unwarn:      0x57F287,
    clearwarns:  0x57F287,
    lock:        0xED4245,
    unlock:      0x57F287,
    slowmode:    0xFEE75C,
    purge:       0xFEE75C,
    nickname:    0x5865F2,
    addrole:     0x57F287,
    removerole:  0xFEE75C,
    voicemove:   0x5865F2,
};

// ────── hierarchy / permissions ──────
function memberCanAct(member, target) {
    if (!member || !target) return false;
    if (member.id === member.guild.ownerId) return true;
    if (target.id === target.guild.ownerId) return false;
    return member.roles.highest.position > target.roles.highest.position;
}

function botCanAct(guild, target) {
    const me = guild.members.me;
    if (!me) return false;
    if (target.id === guild.ownerId) return false;
    return me.roles.highest.position > target.roles.highest.position;
}

// ────── duration ──────
function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts = [];
    if (d) parts.push(`${d}д`);
    if (h) parts.push(`${h}ч`);
    if (m) parts.push(`${m}м`);
    if (sec || !parts.length) parts.push(`${sec}с`);
    return parts.join(' ');
}

// ────── warnings (Supabase) ──────
async function addWarning(guildId, userId, moderatorId, reason) {
    const { data, error } = await supabase
        .from('warnings')
        .insert({
            guild_id:     guildId,
            user_id:      userId,
            moderator_id: moderatorId,
            reason:       reason ?? null,
            timestamp:    Date.now(),
        })
        .select('id')
        .single();

    if (error) {
        console.error('addWarning error:', error);
        throw error;
    }
    return { id: data.id };
}

async function getWarnings(guildId, userId) {
    const { data, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .order('id', { ascending: true });

    if (error) {
        console.error('getWarnings error:', error);
        return [];
    }
    return data ?? [];
}

async function removeWarning(guildId, userId, id) {
    const { data, error } = await supabase
        .from('warnings')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('id', id)
        .select('id');

    if (error) {
        console.error('removeWarning error:', error);
        return false;
    }
    return Array.isArray(data) && data.length > 0;
}

async function clearWarnings(guildId, userId) {
    const { data, error } = await supabase
        .from('warnings')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .select('id');

    if (error) {
        console.error('clearWarnings error:', error);
        return 0;
    }
    return data?.length ?? 0;
}

// ────── modlog channel (Supabase) ──────
async function getModlogChannelId(guildId) {
    const { data, error } = await supabase
        .from('guild_settings')
        .select('modlog_channel_id')
        .eq('guild_id', guildId)
        .maybeSingle();

    if (error) {
        console.error('getModlogChannelId error:', error);
        return null;
    }
    return data?.modlog_channel_id ?? null;
}

async function setModlogChannelId(guildId, channelId) {
    // читаем текущую строку, чтобы не потерять lang/prefix
    const { data: existing } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

    const row = {
        guild_id:          guildId,
        lang:              existing?.lang   ?? 'ru',
        prefix:            existing?.prefix ?? '!',
        modlog_channel_id: channelId,
    };

    const { error } = await supabase
        .from('guild_settings')
        .upsert(row, { onConflict: 'guild_id' });

    if (error) console.error('setModlogChannelId error:', error);
}

// ────── modlog sender ──────
async function sendModlog(client, guild, { title, color, t, target, moderator, reason, extra = [] }) {
    // ── 1. Собираем embed ──
    const fields = [
        { name: t.modlogFieldTarget    ?? 'Цель',      value: target,    inline: false },
        { name: t.modlogFieldModerator ?? 'Модератор', value: moderator, inline: false },
        { name: t.modlogFieldReason    ?? 'Причина',   value: reason ?? (t.modNoReason ?? 'Не указана'), inline: false },
    ];
    for (const f of extra) fields.push(f);

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(null)
        .addFields(fields)
        .setFooter({ text: `${t.request ?? 'Запрос от'} ${client.user.username}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    // ── 2. Отправляем в общий лог-канал (если включено) ──
    try {
        const { sendLogEvent } = require('./logging');
        await sendLogEvent(client, guild, 'mod_action', embed);
    } catch (err) {
        console.error('sendModlog → sendLogEvent failed:', err);
    }

    // ── 3. Отправляем в mod-log канал (если настроен) ──
    const channelId = await getModlogChannelId(guild.id);
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId)
        ?? await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const me = guild.members.me;
    if (!me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) return;

    await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
    MOD_COLORS,
    memberCanAct,
    botCanAct,
    formatDuration,
    addWarning,
    getWarnings,
    removeWarning,
    clearWarnings,
    getModlogChannelId,
    setModlogChannelId,
    sendModlog,
};