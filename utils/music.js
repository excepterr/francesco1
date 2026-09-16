const {
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    AudioPlayerStatus, VoiceConnectionStatus, entersState,
    NoSubscriberBehavior, StreamType,
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');

const queues = new Map(); // guildId -> Queue

// ─────────── Queue ───────────
class Queue {
    constructor(guild, textChannel, voiceChannel) {
        this.guild = guild;
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
        this.songs = [];
        this.index = 0;
        this.loop = 'off';   // off | one | all
        this.volume = 1.0;
        this.playing = false;
        this.connection = null;
        this.player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
        });
        this._bindPlayer();
    }

    get current() {
        return this.songs[this.index] ?? null;
    }

    _bindPlayer() {
        this.player.on(AudioPlayerStatus.Idle, () => {
            const wasPlaying = this.current;
            if (!wasPlaying) return;

            if (this.loop === 'one') {
                this._playCurrent();
                return;
            }
            this.index++;
            if (this.index >= this.songs.length) {
                if (this.loop === 'all' && this.songs.length) {
                    this.index = 0;
                    this._playCurrent();
                } else {
                    this.playing = false;
                    this.destroy();
                }
                return;
            }
            this._playCurrent();
        });

        this.player.on('error', (err) => {
            console.error('[music] player error:', err.message);
            this._handleTrackError();
        });
    }

    _handleTrackError() {
        this.index++;
        if (this.index >= this.songs.length) {
            this.playing = false;
            this.destroy();
            return;
        }
        this._playCurrent();
    }

    async _playCurrent() {
        const song = this.current;
        if (!song) {
            console.log('[music] _playCurrent: нет текущего трека');
            return;
        }

        console.log('[music] запускаю:', song.title, song.url);

        try {
            const stream = ytdl(song.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                dlChunkSize: 0,
            });

            // ловим ошибки стрима
            stream.on('error', (err) => {
                console.error('[music] stream on error:', err.message);
                this._handleTrackError();
            });

            stream.on('info', (info, format) => {
                console.log('[music] поток открыт:', format?.mimeType, format?.bitrate, 'Hz');
            });

            const resource = createAudioResource(stream, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true,
            });
            resource.volume?.setVolume(this.volume);

            resource.playStream.on('error', (err) => {
                console.error('[music] resource error:', err.message);
            });

            this.player.play(resource);
            this.playing = true;

            this.player.once(AudioPlayerStatus.Playing, () => {
                console.log('[music] ▶ играет:', song.title);
            });

            // смотрим, какие статусы проходит плеер
            const statusListener = (oldState, newState) => {
                console.log(`[music] player: ${oldState.status} → ${newState.status}`);
            };
            this.player.on('stateChange', statusListener);
        } catch (err) {
            console.error('[music] stream error (catch):', err.message);
            this._handleTrackError();
        }
    }

    async connect() {
        if (this.connection) return this.connection;

        this.connection = joinVoiceChannel({
            channelId: this.voiceChannel.id,
            guildId: this.guild.id,
            adapterCreator: this.guild.voiceAdapterCreator,
            selfDeaf: true,
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                this.destroy();
            }
        });

        this.connection.subscribe(this.player);
        return this.connection;
    }

    async play() {
        await this.connect();
        this._playCurrent();
    }

    skip() {
        this.player.stop(true);
    }

    pause() {
        return this.player.pause();
    }

    resume() {
        return this.player.unpause();
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(2, v));
        const resource = this.player.state.resource;
        if (resource?.volume) resource.volume.setVolume(this.volume);
    }

    destroy() {
        try { this.player.stop(true); } catch {}
        try { this.connection?.destroy(); } catch {}
        queues.delete(this.guild.id);
    }
}

// ─────────── API ───────────
function getQueue(guildId) {
    return queues.get(guildId) ?? null;
}

function createQueue(guild, textChannel, voiceChannel) {
    let q = queues.get(guild.id);
    if (q) {
        q.textChannel = textChannel;
        q.voiceChannel = voiceChannel;
        return q;
    }
    q = new Queue(guild, textChannel, voiceChannel);
    queues.set(guild.id, q);
    return q;
}

async function searchTrack(query) {
    const isUrl = /^https?:\/\//i.test(query);

    if (isUrl) {
        if (!ytdl.validateURL(query)) return null;
        const info = await ytdl.getBasicInfo(query).catch(() => null);
        if (!info) return null;
        const v = info.videoDetails;
        return {
            title: v.title,
            url: v.video_url,
            duration: parseInt(v.lengthSeconds, 10) || 0,
            thumbnail: v.thumbnails?.[0]?.url ?? null,
            requestedBy: null,
        };
    }

    const res = await yts(query);
    const video = res?.videos?.[0];
    if (!video) return null;

    return {
        title: video.title,
        url: video.url,
        duration: video.seconds,
        thumbnail: video.thumbnail,
        requestedBy: null,
    };
}

function formatDuration(sec) {
    if (!sec || sec < 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

module.exports = {
    getQueue,
    createQueue,
    searchTrack,
    formatDuration,
};