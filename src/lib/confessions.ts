import fs from 'fs/promises';
import path from 'path';
import { supabase } from './supabase';

const DATA_DIR = path.join(process.cwd(), 'data', 'containers');
const MAX_CONTAINERS_PER_GUILD = 2;
const MAX_SIZE_PER_GUILD = 30 * 1024 * 1024;
const MAX_RECENT_CHARS = 1000;
const MAX_FACTS_PER_USER = 100;

const locks = new Map<string, Promise<void>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (locks.has(key)) await locks.get(key);
    let resolve!: () => void;
    const p = new Promise<void>((r) => { resolve = r; });
    locks.set(key, p);
    try {
        return await fn();
    } finally {
        resolve();
        locks.delete(key);
    }
}

export interface Container {
    id: number;
    guild_id: string;
    channel_id: string;
    created_by: string;
    created_at: number;
    size_bytes: number;
    message_count: number;
}

export interface RecentEntry {
    role: 'user' | 'assistant';
    user_id?: string;
    username?: string;
    content: string;
    ts: number;
}

export interface MemoryUser {
    username: string | null;
    facts: string[];
    updated_at: number;
}

export interface ContainerData {
    id: number;
    guild_id: string;
    channel_id: string;
    created_at: number;
    memory: Record<string, MemoryUser>;
    recent: RecentEntry[];
}

function containerPath(guildId: string, id: number): string {
    return path.join(DATA_DIR, guildId, `${id}.json`);
}

async function ensureDir(guildId: string) {
    await fs.mkdir(path.join(DATA_DIR, guildId), { recursive: true });
}

export async function listContainers(guildId: string): Promise<Container[]> {
    const { data } = await supabase
        .from('confession_containers')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: true });
    return (data ?? []) as Container[];
}

export async function getContainerByChannel(
    guildId: string,
    channelId: string,
): Promise<Container | null> {
    const { data } = await supabase
        .from('confession_containers')
        .select('*')
        .eq('guild_id', guildId)
        .eq('channel_id', channelId)
        .maybeSingle();
    return data as Container | null;
}

export async function getContainerById(
    guildId: string,
    id: string,
): Promise<Container | null> {
    const { data } = await supabase
        .from('confession_containers')
        .select('*')
        .eq('guild_id', guildId)
        .eq('id', id)
        .maybeSingle();
    return data as Container | null;
}

export async function createContainer(
    guildId: string,
    channelId: string,
    createdBy: string,
): Promise<Container> {
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
    const empty: ContainerData = {
        id: data.id,
        guild_id: guildId,
        channel_id: channelId,
        created_at: data.created_at,
        memory: {},
        recent: [],
    };
    await fs.writeFile(
        containerPath(guildId, data.id),
        JSON.stringify(empty, null, 2),
        'utf-8',
    );
    return data as Container;
}

export async function deleteContainer(guildId: string, id: string): Promise<void> {
    await supabase
        .from('confession_containers')
        .delete()
        .eq('guild_id', guildId)
        .eq('id', id);
    await fs.unlink(containerPath(guildId, Number(id))).catch(() => {});
}

export async function readContainer(
    guildId: string,
    id: string | number,
): Promise<ContainerData | null> {
    try {
        const raw = await fs.readFile(containerPath(guildId, Number(id)), 'utf-8');
        return JSON.parse(raw) as ContainerData;
    } catch {
        return null;
    }
}

export async function saveContainer(
    guildId: string,
    data: ContainerData,
): Promise<number> {
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

export async function pushRecent(
    guildId: string,
    id: string | number,
    entry: RecentEntry,
): Promise<ContainerData | null> {
    return withLock(`${guildId}:${id}`, async () => {
        const data = await readContainer(guildId, id);
        if (!data) return null;
        if (!Array.isArray(data.recent)) data.recent = [];

        data.recent.push(entry);

        const entryLen = (m: RecentEntry) =>
            (m.username?.length ?? 0) + (m.content?.length ?? 0) + 5;
        let totalChars = data.recent.reduce((a, m) => a + entryLen(m), 0);

        while (totalChars > MAX_RECENT_CHARS && data.recent.length > 1) {
            const removed = data.recent.shift()!;
            totalChars -= entryLen(removed);
        }

        await saveContainer(guildId, data);
        return data;
    });
}

export async function replaceLastAssistant(
    guildId: string,
    id: string | number,
    newContent: string,
): Promise<boolean> {
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

export async function saveFact(
    guildId: string,
    id: string | number,
    userId: string,
    username: string,
    fact: string,
): Promise<boolean> {
    const cleanFact = String(fact).trim().slice(0, 200);
    if (!cleanFact) return false;

    return withLock(`${guildId}:${id}`, async () => {
        const data = await readContainer(guildId, id);
        if (!data) return false;
        if (!data.memory) data.memory = {};
        if (!data.memory[userId]) {
            data.memory[userId] = { username, facts: [], updated_at: Date.now() };
        }

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

export async function updateUsername(
    guildId: string,
    id: string | number,
    userId: string,
    username: string,
): Promise<boolean> {
    return withLock(`${guildId}:${id}`, async () => {
        const data = await readContainer(guildId, id);
        if (!data) return false;
        if (!data.memory) data.memory = {};
        if (!data.memory[userId]) {
            data.memory[userId] = { username, facts: [], updated_at: Date.now() };
        }
        data.memory[userId].username = username;
        await saveContainer(guildId, data);
        return true;
    });
}

export {
    MAX_CONTAINERS_PER_GUILD,
    MAX_SIZE_PER_GUILD,
    MAX_RECENT_CHARS,
    MAX_FACTS_PER_USER,
};