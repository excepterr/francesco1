const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../../utils/settings');

const COLOR = 0x2f3236;

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Информация о роли')
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Информация о роли')
                .addRoleOption(o => o.setName('role').setDescription('Выберите роль').setRequired(true))
        ),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;

        const role = interaction.options.getRole('role');
        const createdTs = Math.floor(role.createdTimestamp / 1000);

        // защита от пустого имени роли (иначе setTitle падает)
        const title = (typeof role.name === 'string' && role.name.trim().length > 0)
            ? role.name
            : (t.roleInfoFallbackTitle ?? 'роль');

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(t.roleInfoSubtitle ?? 'Информация о роли')
            .setColor(role.color || COLOR)
            .addFields(
                { name: t.roleInfoColor ?? 'Цвет', value: `\`${role.hexColor}\`` },
                { name: t.roleInfoCreated ?? 'Дата создания', value: `<t:${createdTs}:f> (<t:${createdTs}:R>)` },
            )
            .setFooter({ text: role.id });

        return interaction.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } });
    },
};