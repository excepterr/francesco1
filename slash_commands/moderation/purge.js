const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 5,
    ephemeral: false,
    botPermissions: ['Управление сообщениями', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Массово удалить сообщения')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(o => o.setName('amount').setDescription('Сколько (1–100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .addUserOption(o => o.setName('user').setDescription('Только от этого участника')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const me = interaction.guild.members.me;
        if (!me?.permissionsIn(interaction.channel).has(PermissionFlagsBits.ManageMessages)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        const messages = await interaction.channel.messages.fetch({ limit: amount });
        const filtered = targetUser ? messages.filter(m => m.author.id === targetUser.id) : messages;

        if (filtered.size === 0) {
            return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.purgeNoMessages)] });
        }

        const deleted = await interaction.channel.bulkDelete(filtered, true);

        await sendModlog(client, interaction.guild, {
            title: t.purgeLog, color: MOD_COLORS.purge, t,
            target: `${interaction.channel} (${interaction.channel.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason: targetUser ? `${targetUser.tag}` : t.modNoReason,
            extra: [{ name: t.logFieldCount, value: `${deleted.size}`, inline: true }],
        });

        const embed = createAlertEmbed('success', user, t.purgeSuccess(deleted.size));
        return interaction.editReply({ embeds: [embed] });
    },
};