const {
    SlashCommandBuilder, EmbedBuilder, ContainerBuilder,
    TextDisplayBuilder, MessageFlags,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const ws = require('../../utils/websearch');

const WIKI_LANGS = ['ru', 'en', 'ja'];

function buildContainer(content, title) {
    const c = new ContainerBuilder().setAccentColor(null);
    if (title) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`),
    );
    return c;
}

module.exports = {
    cooldown: 5,
    ephemeral: false,

    data: new SlashCommandBuilder()
        .setName('websearch')
        .setDescription('Поиск информации в разных источниках')
        .addSubcommand(sub => sub.setName('wiki')
            .setDescription('Поиск в Википедии')
            .addStringOption(o => o.setName('query').setDescription('Что найти').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('genshin')
            .setDescription('Профиль игрока Genshin Impact по UID')
            .addStringOption(o => o.setName('uid').setDescription('UID из игры (9 цифр)').setRequired(true)))
        .addSubcommand(sub => sub.setName('steam')
            .setDescription('Профиль Steam по ID или нику')
            .addStringOption(o => o.setName('id').setDescription('SteamID64 или кастомный URL').setRequired(true)))
        .addSubcommand(sub => sub.setName('youtube')
            .setDescription('Поиск канала на YouTube')
            .addStringOption(o => o.setName('query').setDescription('Название канала').setRequired(true))),

    autocompleteExecute: async (client, interaction) => {
        const focused = interaction.options.getFocused().trim();
        if (focused.length < 2) return interaction.respond([]);
        const { lang } = await getSettings(interaction.guildId);
        const wikiLang = WIKI_LANGS.includes(lang) ? lang : 'en';
        const results = await ws.searchWiki(wikiLang, focused, 10);
        await interaction.respond(results.map(r => ({
            name: r.title.slice(0, 100),
            value: r.title.slice(0, 100),
        })));
    },

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        // ═══════ WIKI ═══════
        if (sub === 'wiki') {
            const query = interaction.options.getString('query').trim();
            const wikiLang = WIKI_LANGS.includes(lang) ? lang : 'en';

            let summary = await ws.getWikiSummary(wikiLang, query);
            if (!summary?.extract) {
                const results = await ws.searchWiki(wikiLang, query, 3);
                if (!results.length) {
                    return interaction.editReply({
                        embeds: [createAlertEmbed('error', user, t.websearchWikiNotFound)],
                    });
                }
                summary = await ws.getWikiSummary(wikiLang, results[0].title);
            }
            if (!summary?.extract) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.websearchWikiNotFound)],
                });
            }

            const pageUrl = summary.content_urls?.desktop?.page
                ?? `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`;

            const description = summary.extract.length > 1500
                ? summary.extract.slice(0, 1497) + '...'
                : summary.extract;

            const embed = new EmbedBuilder()
                .setTitle(summary.title)
                .setURL(pageUrl)
                .setDescription(description)
                .setTimestamp();
            if (summary.thumbnail?.source) embed.setThumbnail(summary.thumbnail.source);

            return interaction.editReply({ embeds: [embed] });
        }

        // ═══════ GENSHIN ═══════
        if (sub === 'genshin') {
            const uid = interaction.options.getString('uid').replace(/\D/g, '');
            if (uid.length < 8) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.websearchGenshinInvalidUid)],
                });
            }

            const profile = await ws.fetchGenshinProfile(uid);
            if (!profile) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.websearchGenshinNotFound(uid))],
                });
            }

            const lines = [
                `**UID:** \`${profile.uid}\``,
                `**Nickname:** ${profile.nickname}`,
                `**Adventure Rank:** ${profile.level}`,
                `**World Level:** ${profile.worldLevel}`,
                `**Achievements:** ${profile.achievements}`,
                `**Abyss:** floor ${profile.abyssFloor}, chamber ${profile.abyssChamber}`,
                `**Characters shown:** ${profile.characters}`,
            ];
            if (profile.signature) lines.push(`\n*${profile.signature}*`);

            const container = buildContainer(lines.join('\n'), t.websearchGenshinTitle);
            return interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ═══════ STEAM ═══════
        if (sub === 'steam') {
            const idInput = interaction.options.getString('id').trim();

            const profile = await ws.fetchSteamProfile(idInput);
            if (!profile) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.websearchSteamNotFound)],
                });
            }

            const lines = [];
            lines.push(`**Nickname:** ${profile.nickname}`);
            if (profile.realName) lines.push(`**Real name:** ${profile.realName}`);
            lines.push(`**SteamID64:** \`${profile.steamId64}\``);
            lines.push(`**Status:** ${profile.status}`);
            if (profile.location) lines.push(`**Location:** ${profile.location}`);
            if (profile.memberSince) lines.push(`**Member since:** ${profile.memberSince}`);
            if (profile.hoursTotal) lines.push(`**Hours (2 weeks):** ${profile.hoursTotal}`);

            if (profile.mostPlayed.length) {
                lines.push('\n**Most played:**');
                for (const g of profile.mostPlayed) {
                    lines.push(`• ${g.name} — \`${g.hours}h\``);
                }
            }

            const flags = [];
            if (profile.vacBanned) flags.push('VAC-ban');
            if (profile.tradeBan && profile.tradeBan !== 'None') flags.push(`Trade: ${profile.tradeBan}`);
            if (flags.length) lines.push(`\n⚠ ${flags.join(' · ')}`);

            lines.push(`\n[Steam profile](${profile.profileUrl})`);

            const container = buildContainer(lines.join('\n'), t.websearchSteamTitle);
            return interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ═══════ YOUTUBE ═══════
        if (sub === 'youtube') {
            const query = interaction.options.getString('query').trim();
            const channels = await ws.searchYouTubeChannel(query);

            if (channels === null) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.websearchYouTubeUnavailable)],
                });
            }
            if (!channels.length) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.websearchYouTubeNotFound)],
                });
            }

            const lines = channels.map((c, i) => {
                const check = c.verified ? ' ✅' : '';
                const handle = c.handle ? `\n> **Handle:** ${c.handle}` : '';
                return `${i + 1}. **${c.name}**${check}${handle}\n> **Subs:** ${c.subs}\n> ${c.url}`;
            });

            const container = buildContainer(lines.join('\n\n'), t.websearchYouTubeTitle(query));
            return interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    },
};