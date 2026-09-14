const {
    SlashCommandBuilder, EmbedBuilder, ContainerBuilder,
    TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    MessageFlags, PermissionFlagsBits,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

function buildContainer(lines, title) {
    const c = new ContainerBuilder().setAccentColor(null);
    if (title) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    }
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`),
    );
    return c;
}

async function ensureVoice(interaction, t) {
    const vc = interaction.member.voice.channel;
    if (!vc) {
        await interaction.editReply({
            embeds: [createAlertEmbed('error', interaction.user, t.musicNeedVoice)],
        });
        return null;
    }
    const me = interaction.guild.members.me;
    if (!me.permissionsIn(vc).has(PermissionFlagsBits.Connect)) {
        await interaction.editReply({
            embeds: [createAlertEmbed('error', interaction.user, t.musicBotNoPerms)],
        });
        return null;
    }
    return vc;
}

async function ensureQueue(interaction, t) {
    const player = interaction.client.moon.players.get(interaction.guildId);
    if (!player || !player.current) {
        await interaction.editReply({
            embeds: [createAlertEmbed('warning', interaction.user, t.musicNothingPlaying)],
        });
        return null;
    }
    return player;
}

module.exports = {
    cooldown: 3,
    ephemeral: false,

    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Музыкальный плеер')
        .addSubcommand(sub => sub.setName('play')
            .setDescription('Включить трек или добавить в очередь')
            .addStringOption(o => o.setName('query')
                .setDescription('Название или ссылка на YouTube')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('skip').setDescription('Пропустить текущий трек'))
        .addSubcommand(sub => sub.setName('stop').setDescription('Остановить и очистить очередь'))
        .addSubcommand(sub => sub.setName('pause').setDescription('Поставить на паузу'))
        .addSubcommand(sub => sub.setName('resume').setDescription('Снять с паузы'))
        .addSubcommand(sub => sub.setName('queue').setDescription('Показать очередь треков'))
        .addSubcommand(sub => sub.setName('nowplaying').setDescription('Показать текущий трек'))
        .addSubcommand(sub => sub.setName('volume')
            .setDescription('Установить громкость')
            .addIntegerOption(o => o.setName('percent').setDescription('0–200%').setMinValue(0).setMaxValue(200).setRequired(true)))
        .addSubcommand(sub => sub.setName('loop')
            .setDescription('Режим повтора')
            .addStringOption(o => o.setName('mode').setDescription('Режим').setRequired(true)
                .addChoices(
                    { name: 'Выкл', value: 'off' },
                    { name: 'Один трек', value: 'track' },
                    { name: 'Вся очередь', value: 'queue' },
                )))
        .addSubcommand(sub => sub.setName('shuffle').setDescription('Перемешать очередь'))
        .addSubcommand(sub => sub.setName('leave').setDescription('Выйти из голосового канала')),

    // ═══════ AUTOCOMPLETE ═══════
    autocompleteExecute: async (client, interaction) => {
        try {
            const focused = interaction.options.getFocused().trim();

            // Слишком короткий запрос — ничего не ищем
            if (focused.length < 2) {
                return interaction.respond([]).catch(() => {});
            }

            const moon = client.moon;

            // Проверим, что есть доступная нода
            const node = moon.nodes?.get?.('main') ?? moon.nodes?.first?.() ?? null;
            if (!node) {
                return interaction.respond([]).catch(() => {});
            }

            const result = await moon.search({
                query: focused,
                requester: interaction.user,
            });

            if (!result?.tracks?.length) {
                return interaction.respond([]).catch(() => {});
            }

            // Отдаём Discord 10 треков
            const choices = result.tracks.slice(0, 10).map(track => {
                const dur = track.duration ?? '—';
                // name до 100 символов (Discord limit)
                const label = `${track.title}`.slice(0, 95);
                return {
                    name: `${label} · ${dur}`.slice(0, 100),
                    // value: URL трека (короче 100 символов у YouTube)
                    value: track.uri ?? track.url ?? track.identifier ?? label,
                };
            });

            await interaction.respond(choices).catch(() => {});
        } catch (err) {
            console.error('[music autocomplete]', err.message);
            await interaction.respond([]).catch(() => {});
        }
    },

    // ═══════ SLASH ═══════
    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;
        const moon = client.moon;

        // ═══════ PLAY ═══════
        if (sub === 'play') {
            const vc = await ensureVoice(interaction, t);
            if (!vc) return;

            const query = interaction.options.getString('query').trim();

            let player = moon.players.get(interaction.guildId);
            if (!player) {
                player = moon.players.create({
                    guildId: interaction.guildId,
                    textChannelId: interaction.channelId,
                    voiceChannelId: vc.id,
                    volume: 100,
                });
            }
            if (!player.connected) {
                await player.connect();
            }

            // moonlink сам поймёт: URL → точный трек, текст → поиск
            const result = await moon.search({ query, requester: user });
            if (!result?.tracks?.length) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.musicNotFound)],
                });
            }

            const track = result.tracks[0];
            track.requester = user.id;
            await player.queue.add(track);

            if (!player.playing) {
                await player.play();
                const container = buildContainer(
                    `${user}, ${t.musicNowPlaying}\n\`\`\`\n${track.title}\n${track.duration} · ${user.username}\n\`\`\``,
                    t.musicTitle,
                );
                return interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const container = buildContainer(
                `${user}, ${t.musicAddedToQueue}\n\`\`\`\n${track.title}\n${track.duration} · ${user.username}\n\`\`\``,
                t.musicTitle,
            );
            return interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ═══════ SKIP ═══════
        if (sub === 'skip') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;
            const skipped = player.current;
            await player.skip();
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicSkipped(skipped?.title ?? '—'))],
            });
        }

        // ═══════ STOP ═══════
        if (sub === 'stop') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;
            await player.destroy();
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicStopped)],
            });
        }

        // ═══════ PAUSE ═══════
        if (sub === 'pause') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;
            await player.pause(true);
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicPaused)],
            });
        }

        // ═══════ RESUME ═══════
        if (sub === 'resume') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;
            await player.pause(false);
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicResumed)],
            });
        }

        // ═══════ QUEUE ═══════
        if (sub === 'queue') {
            const player = moon.players.get(interaction.guildId);
            if (!player || (player.queue.size === 0 && !player.current)) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('warning', user, t.musicQueueEmpty)],
                });
            }

            const lines = [];
            if (player.current) {
                lines.push(`▶ ${player.current.title} \`${player.current.duration}\``);
                lines.push('');
            }

            const upcoming = player.queue.tracks.slice(0, 10);
            if (upcoming.length === 0) {
                lines.push(`*${t.musicQueueEnd}*`);
            } else {
                upcoming.forEach((s, i) => {
                    lines.push(`${i + 1}. ${s.title} \`${s.duration}\``);
                });
            }

            const total = player.queue.size - upcoming.length;
            const footer = total > 0 ? `\n*+${total} ...*` : '';

            const container = buildContainer(
                '```\n' + lines.join('\n') + footer + '\n```',
                `${t.musicQueueTitle} (${player.queue.size})`,
            );
            return interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ═══════ NOWPLAYING ═══════
        if (sub === 'nowplaying') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;

            const cur = player.current;
            const lines = [
                `**${t.musicTrackTitle}:** ${cur.title}`,
                `**${t.musicTrackDuration}:** ${cur.duration}`,
                `**${t.musicTrackRequestedBy}:** <@${cur.requester ?? '0'}>`,
                `**${t.musicTrackLoop}:** ${player.loop}`,
                `**${t.musicTrackVolume}:** ${player.volume}%`,
            ];

            const embed = new EmbedBuilder()
                .setTitle(t.musicTitle)
                .setDescription(lines.join('\n'))
                .setTimestamp();
            if (cur.thumbnail) embed.setThumbnail(cur.thumbnail);

            return interaction.editReply({ embeds: [embed] });
        }

        // ═══════ VOLUME ═══════
        if (sub === 'volume') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;
            const pct = interaction.options.getInteger('percent');
            await player.setVolume(pct);
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicVolumeSet(pct))],
            });
        }

        // ═══════ LOOP ═══════
        if (sub === 'loop') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;
            const mode = interaction.options.getString('mode');
            player.setLoop(mode);
            const labels = { off: t.musicLoopOff, track: t.musicLoopOne, queue: t.musicLoopAll };
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicLoopSet(labels[mode]))],
            });
        }

        // ═══════ SHUFFLE ═══════
        if (sub === 'shuffle') {
            const player = await ensureQueue(interaction, t);
            if (!player) return;
            if (player.queue.size < 3) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('warning', user, t.musicShuffleNoSongs)],
                });
            }
            await player.queue.shuffle();
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicShuffled)],
            });
        }

        // ═══════ LEAVE ═══════
        if (sub === 'leave') {
            const player = moon.players.get(interaction.guildId);
            if (!player) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('warning', user, t.musicNotConnected)],
                });
            }
            await player.destroy();
            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.musicLeft)],
            });
        }
    },
};