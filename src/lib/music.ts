import { Client } from 'discord.js';
import { Shoukaku, Connectors, Player, Track } from 'shoukaku';

const Nodes = [
    {
        name: 'NodeLink',
        url: '127.0.0.1:3000',
        auth: 'youshallnotpass',
    },
];

export let shoukaku: Shoukaku | null = null;

type LoopMode = 'off' | 'track' | 'queue';

const queues = new Map<string, Track[]>();
const loops = new Map<string, LoopMode>();
const history = new Map<string, Track[]>();
const playingNext = new Set<string>();

export function getQueue(guildId: string): Track[] {
    if (!queues.has(guildId)) queues.set(guildId, []);
    return queues.get(guildId)!;
}

export function getLoop(guildId: string): LoopMode {
    return loops.get(guildId) ?? 'off';
}

export function setLoop(guildId: string, mode: LoopMode): void {
    loops.set(guildId, mode);
}

export function getHistory(guildId: string): Track[] {
    if (!history.has(guildId)) history.set(guildId, []);
    return history.get(guildId)!;
}

export function pushHistory(guildId: string, track: Track): void {
    const h = getHistory(guildId);
    h.unshift(track);
    if (h.length > 20) h.pop();
}

export function clearQueueForGuild(guildId: string): void {
    queues.set(guildId, []);
    loops.set(guildId, 'off');
    history.set(guildId, []);
}

export async function playNext(player: Player): Promise<void> {
    const guildId = player.guildId;
    
    // Защита от двойного вызова (например, если skip и событие end сработают одновременно)
    if (playingNext.has(guildId)) return;
    playingNext.add(guildId);

    try {
        const queue = getQueue(guildId);
        const loop = getLoop(guildId);
        const hist = getHistory(guildId);

        // loop track — играем тот же трек
        if (loop === 'track' && hist[0]) {
            const track = hist[0];
            await player.playTrack({ track: { encoded: track.encoded } });
            return;
        }

        // loop queue — возвращаем трек в конец очереди
        if (loop === 'queue' && hist[0]) {
            queue.push(hist[0]);
        }

        if (queue.length === 0) {
            await player.destroy().catch(() => {});
            queues.delete(guildId);
            loops.delete(guildId);
            history.delete(guildId);
            return;
        }

        const track = queue.shift()!;
        pushHistory(guildId, track);
        await player.playTrack({ track: { encoded: track.encoded } });
    } finally {
        // Снимаем блокировку в любом случае
        playingNext.delete(guildId);
    }
}

export function initMusic(client: Client) {
    console.log('[Music] Инициализация...');

    shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, {
        moveOnDisconnect: true,
        resume: true,
        resumeTimeout: 30,
        restTimeout: 10000,
        userId: process.env.CLIENT_ID,
    });

    shoukaku.on('ready', (name) => {
        console.log(`[Music] Node ${name} готова!`);
    });

    shoukaku.on('error', (name, error) => {
        console.error(`[Music] Ошибка на ноде ${name}:`, error);
    });

    // 👇 Shoukaku v4: (player, track, reason)
    shoukaku.on('end', (player, track, reason) => {
        console.log(`[Music] Track ended (reason: ${reason}) guild ${player.guildId}`);

        // Всегда играем следующий. Если очередь пуста — playNext сам
        // вызовет player.destroy() и очистит Map.
        playNext(player).catch((e) => console.error('[Music] playNext:', e));
    });

    // 👇 Shoukaku v4: (player, track, error)
    shoukaku.on('exception', (player, track, error) => {
        console.error(`[Music] Exception guild ${player.guildId}:`, error);
        playNext(player).catch(() => {});
    });

    shoukaku.on('start', (player, track) => {
        console.log(`[Music] Playing "${track.info.title}" in guild ${player.guildId}`);
    });
}