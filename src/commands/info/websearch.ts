import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    AutocompleteInteraction,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import * as ws from '../../lib/websearch';

const WIKI_LANGS = ['ru', 'en', 'ja'];

export default {
    data: new SlashCommandBuilder()
        .setName('websearch')
        .setDescription('Search information in various sources.')
        .setDescriptionLocalizations(getLocalizations('commands.websearch.description'))
        .addSubcommand((sub) =>
            sub
                .setName('wiki')
                .setDescription('Search Wikipedia.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.websearch.wiki.description'),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('query')
                        .setDescription('What to search.')
                        .setRequired(true)
                        .setAutocomplete(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.websearch.wiki.option'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('genshin')
                .setDescription('Genshin Impact player profile by UID.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.websearch.genshin.description'),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('uid')
                        .setDescription('In-game UID (9 digits).')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.websearch.genshin.option'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('steam')
                .setDescription('Steam profile by ID or vanity URL.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.websearch.steam.description'),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('id')
                        .setDescription('SteamID64 or custom URL.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.websearch.steam.option'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('youtube')
                .setDescription('Search YouTube channels.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.websearch.youtube.description'),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('query')
                        .setDescription('Channel name.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.websearch.youtube.option'),
                        ),
                ),
        ),

    // Отдельный обработчик для autocomplete
    async autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused().trim();
        if (focused.length < 2) return interaction.respond([]);

        const lang = getUserLanguage(interaction as any);
        const wikiLang = WIKI_LANGS.includes(lang) ? lang : 'en';
        const results = await ws.searchWiki(wikiLang, focused, 10);

        await interaction.respond(
            results.map((r) => ({
                name: r.title.slice(0, 100),
                value: r.title.slice(0, 100),
            })),
        );
    },

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const lang = getUserLanguage(interaction);

        // ============ WIKI ============
        if (sub === 'wiki') {
            const query = interaction.options.getString('query', true).trim();
            const wikiLang = WIKI_LANGS.includes(lang) ? lang : 'en';

            let summary = await ws.getWikiSummary(wikiLang, query);
            if (!summary?.extract) {
                const results = await ws.searchWiki(wikiLang, query, 3);
                if (!results.length) throw new UserError(t(lang, 'websearch.wikiNotFound'));
                summary = await ws.getWikiSummary(wikiLang, results[0].title);
            }
            if (!summary?.extract) throw new UserError(t(lang, 'websearch.wikiNotFound'));

            const pageUrl =
                summary.content_urls?.desktop?.page ??
                `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`;

            const description =
                summary.extract.length > 1500
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

        // ============ GENSHIN ============
        if (sub === 'genshin') {
            const uid = interaction.options.getString('uid', true).replace(/\D/g, '');
            if (uid.length < 8) throw new UserError(t(lang, 'websearch.genshinInvalidUid'));

            const profile = await ws.fetchGenshinProfile(uid);
            if (!profile) throw new UserError(t(lang, 'websearch.genshinNotFound'));

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

            const embed = new EmbedBuilder()
                .setDescription(`### ${t(lang, 'websearch.genshinTitle')}\n\n${lines.join('\n')}`)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ============ STEAM ============
        if (sub === 'steam') {
            const idInput = interaction.options.getString('id', true).trim();
            const profile = await ws.fetchSteamProfile(idInput);
            if (!profile) throw new UserError(t(lang, 'websearch.steamNotFound'));

            const lines = [`**Nickname:** ${profile.nickname}`];
            if (profile.realName) lines.push(`**Real name:** ${profile.realName}`);
            lines.push(`**SteamID64:** \`${profile.steamId64}\``);
            if (profile.location) lines.push(`**Location:** ${profile.location}`);
            if (profile.memberSince) lines.push(`**Member since:** ${profile.memberSince}`);
            lines.push(`\n[Steam profile](${profile.profileUrl})`);

            const embed = new EmbedBuilder()
                .setDescription(`### ${t(lang, 'websearch.steamTitle')}\n\n${lines.join('\n')}`)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ============ YOUTUBE ============
        if (sub === 'youtube') {
            const query = interaction.options.getString('query', true).trim();
            const channels = await ws.searchYouTubeChannel(query);

            if (channels === null) throw new UserError(t(lang, 'websearch.youtubeUnavailable'));
            if (!channels.length) throw new UserError(t(lang, 'websearch.youtubeNotFound'));

            const lines = channels.map((c, i) => {
                const check = c.verified ? ' ✅' : '';
                const handle = c.handle ? `\n> **Handle:** ${c.handle}` : '';
                return `${i + 1}. **${c.name}**${check}${handle}\n> **Subs:** ${c.subs}\n> ${c.url}`;
            });

            const embed = new EmbedBuilder()
                .setDescription(
                    `### ${t(lang, 'websearch.youtubeTitle')} — ${query}\n\n${lines.join('\n\n')}`,
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    },
};