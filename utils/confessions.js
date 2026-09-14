const fs = require('fs').promises;
const path = require('path');
const supabase = require('./supabase');

const DATA_DIR = path.join(__dirname, '..', 'data', 'containers');
const MAX_CONTAINERS_PER_GUILD = 2;
const MAX_SIZE_PER_GUILD = 30 * 1024 * 1024; // 30 МБ
const MAX_RECENT_CHARS = 1000;                // окно диалога
const MAX_FACTS_PER_USER = 100;

const locks = new Map();

async function withLock(key, fn) {
    while (locks.has(key)) await locks.get(key);
    let resolve;
    const p = new Promise(r => { resolve = r; });
    locks.set(key, p);
    try { return await fn(); }
    finally { resolve(); locks.delete(key); }
}

function containerPath(guildId, id) {
    return path.join(DATA_DIR, guildId, `${id}.json`);
}

async function ensureDir(guildId) {
    await fs.mkdir(path.join(DATA_DIR, guildId), { recursive: true });
}

async function listContainers(guildId) {
    const { data } = await supabase
        .from('confession_containers')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: true });
    return data ?? [];
}

async function getContainerByChannel(guildId, channelId) {
    const { data } = await supabase
        .from('confession_containers')
        .select('*')
        .eq('guild_id', guildId)
        .eq('channel_id', channelId)
        .maybeSingle();
    return data;
}

async function getContainerById(guildId, id) {
    const { data } = await supabase
        .from('confession_containers')
        .select('*')
        .eq('guild_id', guildId)
        .eq('id', id)
        .maybeSingle();
    return data;
}

async function createContainer(guildId, channelId, createdBy) {
    const existing = await listContainers(guildId);

    if (existing.length >= MAX_CONTAINERS_PER_GUILD) throw new Error('MAX_CONTAINERS');
    const totalSize = existing.reduce((a, c) => a + (c.size_bytes || 0), 0);
    if (totalSize >= MAX_SIZE_PER_GUILD) throw new Error('MAX_SIZE');

    const { data, error } = await supabase
        .from('confession_containers')
        .insert({
            guild_id: guildId,
            channel_id: channelId,
            created_by: createdBy,
            created_at: Date.now(),
            size_bytes: 0,
            message_count: 0,
        })
        .select('*')
        .single();

    if (error) throw error;

    await ensureDir(guildId);
    const empty = {
        id: data.id,
        guild_id: guildId,
        channel_id: channelId,
        created_at: data.created_at,
        memory: {},
        recent: [],
    };
    await fs.writeFile(containerPath(guildId, data.id), JSON.stringify(empty, null, 2), 'utf-8');
    return data;
}

async function deleteContainer(guildId, id) {
    await supabase.from('confession_containers').delete().eq('guild_id', guildId).eq('id', id);
    await fs.unlink(containerPath(guildId, id)).catch(() => {});
}

async function readContainer(guildId, id) {
    try {
        const raw = await fs.readFile(containerPath(guildId, id), 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function saveContainer(guildId, data) {
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(containerPath(guildId, data.id), json, 'utf-8');
    const size = Buffer.byteLength(json, 'utf-8');

    await supabase
        .from('confession_containers')
        .update({ size_bytes: size, message_count: (data.recent ?? []).length })
        .eq('id', data.id)
        .eq('guild_id', guildId);

    return size;
}

async function pushRecent(guildId, id, entry) {
    return withLock(`${guildId}:${id}`, async () => {
        const data = await readContainer(guildId, id);
        if (!data) return null;
        if (!Array.isArray(data.recent)) data.recent = [];

        data.recent.push(entry);

        const entryLen = m => (m.username?.length ?? 0) + (m.content?.length ?? 0) + 5;
        let totalChars = data.recent.reduce((a, m) => a + entryLen(m), 0);

        while (totalChars > MAX_RECENT_CHARS && data.recent.length > 1) {
            const removed = data.recent.shift();
            totalChars -= entryLen(removed);
        }

        await saveContainer(guildId, data);
        return data;
    });
}

async function replaceLastAssistant(guildId, id, newContent) {
    return withLock(`${guildId}:${id}`, async () => {
        const data = await readContainer(guildId, id);
        if (!data || !Array.isArray(data.recent)) return false;

        for (let i = data.recent.length - 1; i >= 0; i--) {
            if (data.recent[i].role === 'assistant') {
                data.recent[i].content = newContent;
                data.recent[i].ts = Date.now();
                await saveContainer(guildId, data);
                return true;
            }
        }
        return false;
    });
}

async function saveFact(guildId, id, userId, username, fact) {
    const cleanFact = String(fact).trim().slice(0, 200);
    if (!cleanFact) return false;

    return withLock(`${guildId}:${id}`, async () => {
        const data = await readContainer(guildId, id);
        if (!data) return false;
        if (!data.memory) data.memory = {};
        if (!data.memory[userId]) data.memory[userId] = { username: username ?? null, facts: [], updated_at: Date.now() };

        const entry = data.memory[userId];
        entry.username = username ?? entry.username;
        entry.updated_at = Date.now();

        if (!entry.facts.includes(cleanFact)) entry.facts.push(cleanFact);
        if (entry.facts.length > MAX_FACTS_PER_USER) {
            entry.facts.splice(0, entry.facts.length - MAX_FACTS_PER_USER);
        }

        await saveContainer(guildId, data);
        return true;
    });
}

async function updateUsername(guildId, id, userId, username) {
    return withLock(`${guildId}:${id}`, async () => {
        const data = await readContainer(guildId, id);
        if (!data) return false;
        if (!data.memory) data.memory = {};
        if (!data.memory[userId]) data.memory[userId] = { username: null, facts: [], updated_at: Date.now() };
        data.memory[userId].username = username;
        await saveContainer(guildId, data);
        return true;
    });
}

module.exports = {
    MAX_CONTAINERS_PER_GUILD,
    MAX_SIZE_PER_GUILD,
    MAX_RECENT_CHARS,
    MAX_FACTS_PER_USER,
    listContainers,
    getContainerByChannel,
    getContainerById,
    createContainer,
    deleteContainer,
    readContainer,
    saveContainer,
    pushRecent,
    replaceLastAssistant,
    saveFact,
    updateUsername,
};