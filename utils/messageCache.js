// Кэш последних N сообщений на канал: чтобы при messageDelete
// иметь content/author, которых Discord в partial-событии не даёт.

const MAX_PER_CHANNEL = 200;
const MAX_CHANNELS = 1000;

const cache = new Map(); // channelId -> Map<messageId, { author, content, attachments }>

function remember(message) {
    if (!message.guild) return;
    let ch = cache.get(message.channelId);
    if (!ch) {
        ch = new Map();
        cache.set(message.channelId, ch);

        // чистим старые каналы
        if (cache.size > MAX_CHANNELS) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
    }
    ch.set(message.id, {
        author: message.author ? {
            id: message.author.id,
            tag: message.author.tag,
            username: message.author.username,
            bot: message.author.bot,
            avatarURL: message.author.displayAvatarURL?.({ size: 128 }) ?? null,
        } : null,
        content: message.content ?? '',
        attachments: message.attachments?.map(a => ({
            name: a.name, url: a.url, size: a.size,
        })) ?? [],
    });

    // держим только последние N
    if (ch.size > MAX_PER_CHANNEL) {
        const firstKey = ch.keys().next().value;
        ch.delete(firstKey);
    }
}

function get(channelId, messageId) {
    return cache.get(channelId)?.get(messageId) ?? null;
}

function remove(channelId, messageId) {
    cache.get(channelId)?.delete(messageId);
}

function clearChannel(channelId) {
    cache.delete(channelId);
}

module.exports = { remember, get, remove, clearChannel };