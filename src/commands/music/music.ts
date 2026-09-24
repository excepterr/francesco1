import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    EmbedBuilder,
} from 'discord.js';
import {
    shoukaku,
    getQueue,
    getHistory,
    getLoop,
    setLoop,
    playNext,
    clearQueueForGuild,
} from '../../lib/music';
import { UserError } from '../../lib/errors';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

async function waitForNode(timeout = 10_000) {
    if (!shoukaku) return null;
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const node = shoukaku.options.nodeResolver(shoukaku.nodes);
        if (node) return node;
        await new Promise((r) => setTimeout(r, 300));
    }
    return null;
}

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Music commands.')
        .setDescriptionLocalizations(getLocalizations('commands.music.description'))

        .addSubcommand((sub) =>
            sub
                .setName('play')
                .setDescription('Play a song from YouTube.')
                .setDescriptionLocalizations(getLocalizations('commands.music.play.description'))
                .addStringOption((o) =>
                    o.setName('query')
                        .setDescription('Song name or YouTube URL.')
                        .setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.music.play.queryOption')),
                ),
        )

        .addSubcommand((sub) =>
            sub.setName('skip').setDescription('Skip the current track.')
                .setDescriptionLocalizations(getLocalizations('commands.music.skip.description')),
        )

        .addSubcommand((sub) =>
            sub.setName('pause').setDescription('Pause playback.')
                .setDescriptionLocalizations(getLocalizations('commands.music.pause.description')),
        )

        .addSubcommand((sub) =>
            sub.setName('resume').setDescription('Resume playback.')
                .setDescriptionLocalizations(getLocalizations('commands.music.resume.description')),
        )

        .addSubcommand((sub) =>
            sub.setName('stop').setDescription('Stop and clear the queue.')
                .setDescriptionLocalizations(getLocalizations('commands.music.stop.description')),
        )

        .addSubcommand((sub) =>
            sub.setName('nowplaying').setDescription('Show what is playing now.')
                .setDescriptionLocalizations(getLocalizations('commands.music.nowplaying.description')),
        )

        .addSubcommand((sub) =>
            sub.setName('queue').setDescription('Show the queue.')
                .setDescriptionLocalizations(getLocalizations('commands.music.queue.description')),
        )

        .addSubcommand((sub) =>
            sub
                .setName('volume')
                .setDescription('Set volume (0-200).')
                .setDescriptionLocalizations(getLocalizations('commands.music.volume.description'))
                .addIntegerOption((o) =>
                    o.setName('value').setDescription('Volume 0-200.').setRequired(true)
                        .setMinValue(0).setMaxValue(200)
                        .setDescriptionLocalizations(getLocalizations('commands.music.volume.valueOption')),
                ),
        )

        .addSubcommand((sub) =>
            sub
                .setName('loop')
                .setDescription('Set loop mode.')
                .setDescriptionLocalizations(getLocalizations('commands.music.loop.description'))
                .addStringOption((o) =>
                    o.setName('mode').setDescription('Loop mode.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.music.loop.modeOption'))
                        .addChoices(
                            { name: 'Off', value: 'off' },
                            { name: 'Track', value: 'track' },
                            { name: 'Queue', value: 'queue' },
                        ),
                ),
        )

        .addSubcommand((sub) =>
            sub.setName('shuffle').setDescription('Shuffle the queue.')
                .setDescriptionLocalizations(getLocalizations('commands.music.shuffle.description')),
        )

        .addSubcommand((sub) =>
            sub
                .setName('seek')
                .setDescription('Seek to a position (seconds).')
                .setDescriptionLocalizations(getLocalizations('commands.music.seek.description'))
                .addIntegerOption((o) =>
                    o.setName('seconds').setDescription('Seconds.').setRequired(true).setMinValue(0)
                        .setDescriptionLocalizations(getLocalizations('commands.music.seek.secondsOption')),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        // ─── PLAY ───
        if (sub === 'play') {
            const member = interaction.member as GuildMember;
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel) throw new UserError(t(lang, 'music.noVoiceChannel'));
            if (!shoukaku) throw new UserError(t(lang, 'music.noNode'));

            const node = await waitForNode();
            if (!node) throw new UserError(t(lang, 'music.noNode'));

            const query = interaction.options.getString('query', true);
            const isUrl = /^https?:\/\//.test(query);
            const searchQuery = isUrl ? query : `ytsearch:${query}`;

            const result = await node.rest.resolve(searchQuery);
            if (!result) throw new UserError(t(lang, 'music.notFound'));

            // search → берём ТОЛЬКО ПЕРВЫЙ трек
            // track  → 1 трек
            // playlist → все треки плейлиста
            let tracks: any[] = [];
            if (result.loadType === 'track') {
                tracks = [result.data];
            } else if (result.loadType === 'search') {
                const data = Array.isArray(result.data) ? result.data : [];
                if (data.length > 0) tracks = [data[0]];
            } else if (result.loadType === 'playlist') {
                tracks = (result.data as any)?.tracks ?? [];
            }

            if (tracks.length === 0) throw new UserError(t(lang, 'music.notFound'));

            let player = shoukaku.players.get(guildId);
            const noPlayer = !player;
            if (!player) {
                player = await shoukaku.joinVoiceChannel({
                    guildId,
                    channelId: voiceChannel.id,
                    shardId: interaction.guild!.shardId,
                    deaf: true,
                });
            }

            const queue = getQueue(guildId);
            for (const track of tracks) queue.push(track);
            if (noPlayer) await playNext(player);

            const first = tracks[0];
            const embed = new EmbedBuilder()
                .setTitle(t(lang, 'music.addedToQueue'))
                .setDescription(`[${first.info.title}](${first.info.uri})`)
                .setThumbnail(first.info.artworkUrl ?? null)
                .addFields({
                    name: t(lang, 'music.author'),
                    value: first.info.author ?? '—',
                    inline: true,
                });

            if (tracks.length > 1) {
                embed.addFields({
                    name: t(lang, 'music.tracksAdded'),
                    value: `${tracks.length}`,
                    inline: true,
                });
            }
            embed.setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

            // ─── SKIP ───
        if (sub === 'skip') {
            const player = shoukaku?.players.get(guildId);
            if (!player) throw new UserError(t(lang, 'music.notPlaying'));

            // Вместо player.stopTrack() вызываем playNext.
            // Это принудительно заменит текущий трек на следующий из очереди.
            await playNext(player);

            await interaction.editReply({ content: t(lang, 'music.skipped') });
            return;
        }

        // ─── PAUSE ───
        if (sub === 'pause') {
            const player = shoukaku?.players.get(guildId);
            if (!player) throw new UserError(t(lang, 'music.notPlaying'));
            await player.setPaused(true);
            await interaction.editReply({ content: t(lang, 'music.paused') });
            return;
        }

        // ─── RESUME ───
        if (sub === 'resume') {
            const player = shoukaku?.players.get(guildId);
            if (!player) throw new UserError(t(lang, 'music.notPlaying'));
            await player.setPaused(false);
            await interaction.editReply({ content: t(lang, 'music.resumed') });
            return;
        }

        // ─── STOP ───
        if (sub === 'stop') {
            const player = shoukaku?.players.get(guildId);
            if (!player) throw new UserError(t(lang, 'music.notPlaying'));
            clearQueueForGuild(guildId);
            await player.destroy();
            await interaction.editReply({ content: t(lang, 'music.stopped') });
            return;
        }

        // ─── NOWPLAYING ───
        if (sub === 'nowplaying') {
            const hist = getHistory(guildId);
            const track = hist[0];
            if (!track) throw new UserError(t(lang, 'music.notPlaying'));

            const loop = getLoop(guildId);
            const embed = new EmbedBuilder()
                .setTitle(t(lang, 'music.nowplayingTitle'))
                .setDescription(`[${track.info.title}](${track.info.uri})`)
                .setThumbnail(track.info.artworkUrl ?? null)
                .addFields(
                    { name: t(lang, 'music.author'), value: track.info.author ?? '—', inline: true },
                    { name: t(lang, 'music.length'), value: `${Math.round(track.info.length / 1000)}s`, inline: true },
                    { name: t(lang, 'music.loop'), value: loop, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ─── QUEUE ───
        if (sub === 'queue') {
            const queue = getQueue(guildId);
            const hist = getHistory(guildId);
            if (queue.length === 0 && hist.length === 0) {
                throw new UserError(t(lang, 'music.queueEmpty'));
            }

            const lines: string[] = [];
            if (hist[0]) {
                lines.push(`**${t(lang, 'music.nowPlaying')}**`);
                lines.push(`▶ ${hist[0].info.title}`);
                lines.push('');
            }
            if (queue.length > 0) {
                lines.push(`**${t(lang, 'music.queue')}** (${queue.length})`);
                queue.slice(0, 15).forEach((tr, i) => lines.push(`${i + 1}. ${tr.info.title}`));
                if (queue.length > 15) {
                    lines.push(`… ${t(lang, 'music.andMore', { n: queue.length - 15 })}`);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(t(lang, 'music.queueTitle'))
                .setDescription(lines.join('\n').slice(0, 4000))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ─── VOLUME ───
        if (sub === 'volume') {
            const value = interaction.options.getInteger('value', true);
            const player = shoukaku?.players.get(guildId);
            if (!player) throw new UserError(t(lang, 'music.notPlaying'));
            await player.setGlobalVolume(value);
            await interaction.editReply({ content: t(lang, 'music.volumeSet', { value }) });
            return;
        }

        // ─── LOOP ───
        if (sub === 'loop') {
            const mode = interaction.options.getString('mode', true) as 'off' | 'track' | 'queue';
            if (getLoop(guildId) === mode) throw new UserError(t(lang, 'music.loopSame'));
            setLoop(guildId, mode);
            await interaction.editReply({ content: t(lang, 'music.loopSet', { mode }) });
            return;
        }

        // ─── SHUFFLE ───
        if (sub === 'shuffle') {
            const queue = getQueue(guildId);
            if (queue.length < 2) throw new UserError(t(lang, 'music.queueTooSmall'));

            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
            await interaction.editReply({ content: t(lang, 'music.shuffled', { count: queue.length }) });
            return;
        }

        // ─── SEEK ───
        if (sub === 'seek') {
            const seconds = interaction.options.getInteger('seconds', true);
            const player = shoukaku?.players.get(guildId);
            if (!player) throw new UserError(t(lang, 'music.notPlaying'));
            const track = getHistory(guildId)[0];
            if (!track) throw new UserError(t(lang, 'music.notPlaying'));

            const ms = Math.min(seconds * 1000, track.info.length);
            await player.seekTo(ms);
            await interaction.editReply({ content: t(lang, 'music.seeked', { seconds: Math.floor(ms / 1000) }) });
            return;
        }
    },
};