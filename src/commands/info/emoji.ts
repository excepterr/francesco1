import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageComponentInteraction,
} from 'discord.js';
import { MyClient } from '../../client';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import { createCollector } from '../../lib/components';

const PAGE_SIZE = 10;

function buildPage(
    emojis: any[],
    lang: string,
    page: number,
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
    const total = Math.max(1, Math.ceil(emojis.length / PAGE_SIZE));
    const slice = emojis.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const lines = slice.map((e, i) => {
        const idx = page * PAGE_SIZE + i + 1;
        const createdTs = Math.floor(e.createdTimestamp / 1000);
        return [
            `${idx}. ${e} (${e.id})`,
            `> ${t(lang, 'emoji.animated')}: ${e.animated ? t(lang, 'yes') : t(lang, 'no')}`,
            `> ${t(lang, 'emoji.created')}: <t:${createdTs}:D>`,
        ].join('\n');
    });

    const embed = new EmbedBuilder()
        .setDescription(
            `### ${t(lang, 'emoji.listTitle')} — ${page + 1}/${total}\n\n${lines.join('\n\n')}`,
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('emoji_prev')
            .setLabel('◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId('emoji_next')
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= total - 1),
    );

    return { embed, row };
}

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Server emojis.')
        .setDescriptionLocalizations(getLocalizations('commands.emoji.description'))
        .addSubcommand((sub) =>
            sub
                .setName('list')
                .setDescription('List all server emojis.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.emoji.list.description'),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('info')
                .setDescription('Show information about an emoji.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.emoji.info.description'),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('emoji')
                        .setDescription('Name or ID of the emoji.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.emoji.info.option'),
                        ),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const lang = getUserLanguage(interaction);

        if (!interaction.guild) throw new UserError(t(lang, 'errors.guildOnly'));

        const emojis = [...interaction.guild.emojis.cache.values()].sort((a, b) =>
            a.name!.localeCompare(b.name!),
        );

        // ============ LIST ============
        if (sub === 'list') {
            if (!emojis.length) {
                throw new UserError(t(lang, 'emoji.listEmpty'));
            }

            const { embed, row } = buildPage(emojis, lang, 0);
            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true,
            });

            let page = 0;
            const total = Math.ceil(emojis.length / PAGE_SIZE);

            createCollector(interaction.user.id, response, {
                lang,
                onCollect: async (i: MessageComponentInteraction) => {
                    if (!i.isButton()) return;

                    if (i.customId === 'emoji_prev') page = Math.max(0, page - 1);
                    else if (i.customId === 'emoji_next') page = Math.min(total - 1, page + 1);
                    else return;

                    const { embed, row } = buildPage(emojis, lang, page);
                    await i.update({ embeds: [embed], components: [row] });
                },
            });
            return;
        }

        // ============ INFO ============
        if (sub === 'info') {
            await interaction.deferReply();
            const raw = interaction.options.getString('emoji', true).trim();
            const id = raw.match(/(\d{17,20})/)?.[1];
            const query = raw.replace(/^<a?:/, '').replace(/:?\d*>?$/, '');

            const emoji =
                (id && emojis.find((e) => e.id === id)) ||
                emojis.find((e) => e.name === query) ||
                emojis.find((e) => e.name?.toLowerCase() === query.toLowerCase());

            if (!emoji) throw new UserError(t(lang, 'emoji.notFound'));

            const createdTs = Math.floor(emoji.createdTimestamp / 1000);
            const embed = new EmbedBuilder()
                .setDescription(`### ${emoji.name}`)
                .setThumbnail(emoji.imageURL({ size: 256 }))
                .addFields(
                    { name: t(lang, 'emoji.id'), value: `\`${emoji.id}\``, inline: true },
                    {
                        name: t(lang, 'emoji.animated'),
                        value: emoji.animated ? t(lang, 'yes') : t(lang, 'no'),
                        inline: true,
                    },
                    {
                        name: t(lang, 'emoji.created'),
                        value: `<t:${createdTs}:D>`,
                        inline: true,
                    },
                );

            await interaction.editReply({ embeds: [embed] });
        }
    },
};