const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const COLOR = 0x2f3236; // Твой фирменный серый цвет

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Показывает аватар пользователя')
        .addUserOption(option =>
            option
                .setName('member')
                .setDescription('Выберите пользователя (по умолчанию ваш)')
                .setRequired(false)
        ),

    slashExecute: async (client, interaction) => {
        const targetUser = interaction.options.getUser('member') || interaction.user;
        const avatarURL = targetUser.displayAvatarURL({ size: 4096, extension: 'png' });

        const embed = new EmbedBuilder()
            .setTitle(`${targetUser.username} (ID: ${targetUser.id})`)
            .setURL(avatarURL)
            .setColor(COLOR)
            .setImage(avatarURL)
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            allowedMentions: { parse: [], repliedUser: false }
        });
    },
};
