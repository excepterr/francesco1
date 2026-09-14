const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Банить участников', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Разблокировать пользователя по ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o.setName('user').setDescription('ID заблокированного').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        }

        const targetUser = interaction.options.getUser('user');
        const ban = await interaction.guild.bans.fetch(targetUser.id).catch(() => null);
        if (!ban) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.unbanFail)] });

        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        await interaction.guild.members.unban(ban.user.id, `${reason} | ${user.tag}`);

        await sendModlog(client, interaction.guild, {
            title: t.unbanLog, color: MOD_COLORS.unban, t,
            target: `${ban.user.tag} (${ban.user.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
        });

        const embed = createAlertEmbed('success', user, t.unbanSuccess(ban.user.tag), {
            modStyle: true, targetUser: ban.user, reason, t,
        });
        return interaction.editReply({ embeds: [embed] });
    },
};