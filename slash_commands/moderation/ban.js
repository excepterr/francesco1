const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog, memberCanAct, botCanAct } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Банить участников', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Заблокировать участника')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Причина'))
        .addIntegerOption(o => o.setName('delete_days').setDescription('Удалить сообщения за N дней (0–7)').setMinValue(0).setMaxValue(7)),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modMemberNotFound)] });
        if (member.id === user.id) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modCantTargetSelf)] });
        if (member.id === interaction.guild.ownerId) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modCantTargetOwner)] });
        if (!memberCanAct(interaction.member, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyUser)] });

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        if (!botCanAct(interaction.guild, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyBot)] });

        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        const days = interaction.options.getInteger('delete_days') ?? 0;

        await member.ban({ deleteMessageSeconds: days * 86400, reason: `${reason} | ${user.tag}` });

        await sendModlog(client, interaction.guild, {
            title: t.banLog, color: MOD_COLORS.ban, t,
            target: `${member.user.tag} (${member.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
            extra: days > 0 ? [{ name: t.modDuration, value: `${days}d`, inline: true }] : [],
        });

        const embed = createAlertEmbed('success', user, t.banSuccess(member.user.tag), {
            modStyle: true, targetUser: member.user, reason, t,
        });
        return interaction.editReply({ embeds: [embed] });
    },
};