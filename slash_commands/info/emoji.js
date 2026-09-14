const {
    SlashCommandBuilder, EmbedBuilder, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const PAGE_SIZE = 10;

function buildPage(client, interaction, t, emojis, page) {
    const total = Math.ceil(emojis.length / PAGE_SIZE);
    const slice = emojis.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const lines = slice.map((e, i) => {
        const idx = page * PAGE_SIZE + i + 1;
        const createdTs = Math.floor(e.createdTimestamp / 1000);
        return [
            `${idx}. ${e} (${e.id})`,
            `> ${t.emojiAnimated}: ${e.animated ? t.yes : t.no}`,
            `> ${t.emojiCreated}: <t:${createdTs}:D>`,
        ].join('\n');
    });

    const embed = new EmbedBuilder()
        .setTitle(`${t.emojiListTitle} — ${page + 1}/${total}`)
        .setDescription(lines.join('\n\n'))
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`emoji_prev:${interaction.user.id}:${page}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`emoji_next:${interaction.user.id}:${page}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= total - 1),
    );

    return { embed, row };
}

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Эмодзи сервера')
        .addSubcommand(s => s.setName('list').setDescription('Список эмодзи'))
        .addSubcommand(s => s.setName('info').setDescription('Информация об эмодзи')
            .addStringOption(o => o.setName('emoji').setDescription('Имя или ID').setRequired(true))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;
        const emojis = [...interaction.guild.emojis.cache.values()].sort((a, b) => a.name.localeCompare(b.name));

        if (sub === 'list') {
            if (!emojis.length) {
                return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.emojiListEmpty)] });
            }
            const { embed, row } = buildPage(client, interaction, t, emojis, 0);
            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        if (sub === 'info') {
            const raw = interaction.options.getString('emoji').trim();
            const id = raw.match(/(\d{17,20})/)?.[1];
            const query = raw.replace(/^<a?:/, '').replace(/:?\d*>?$/, '');

            const emoji = (id && emojis.find(e => e.id === id))
                || emojis.find(e => e.name === query)
                || emojis.find(e => e.name.toLowerCase() === query.toLowerCase());

            if (!emoji) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.emojiNotFound)] });
            }

            const createdTs = Math.floor(emoji.createdTimestamp / 1000);
            const embed = new EmbedBuilder()
                .setTitle(emoji.name)
                .setThumbnail(emoji.imageURL({ size: 256 }))
                .addFields(
                    { name: t.emojiId, value: `\`${emoji.id}\``, inline: true },
                    { name: t.emojiAnimated, value: emoji.animated ? t.yes : t.no, inline: true },
                    { name: t.emojiCreated, value: `<t:${createdTs}:D>`, inline: true },
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    },

    components: {
        emoji_prev: async (client, interaction) => {
            await interaction.deferUpdate();
            const [, userId, pageStr] = interaction.customId.split(':');
            if (userId !== interaction.user.id) return;

            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const emojis = [...interaction.guild.emojis.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
            const page = Math.max(0, parseInt(pageStr) - 1);
            const { embed, row } = buildPage(client, interaction, t, emojis, page);
            return interaction.editReply({ embeds: [embed], components: [row] });
        },
        emoji_next: async (client, interaction) => {
            await interaction.deferUpdate();
            const [, userId, pageStr] = interaction.customId.split(':');
            if (userId !== interaction.user.id) return;

            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const emojis = [...interaction.guild.emojis.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
            const total = Math.ceil(emojis.length / PAGE_SIZE);
            const page = Math.min(total - 1, parseInt(pageStr) + 1);
            const { embed, row } = buildPage(client, interaction, t, emojis, page);
            return interaction.editReply({ embeds: [embed], components: [row] });
        },
    },
};