const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Отправить сообщение от имени бота')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option
                .setName('content')
                .setDescription('Текст, который напишет бот')
                .setRequired(true)
        ),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;

        const text = interaction.options.getString('content');
        await interaction.channel.send({ content: text });

        return interaction.reply({
            content: "Текст скоро отправится.",
            flags: MessageFlags.Ephemeral
        });
    },
};