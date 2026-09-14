const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog, memberCanAct, botCanAct } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Выгонять участников', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Выгнать участника с сервера')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modMemberNotFound)] });
        if (member.id === user.id) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modCantTargetSelf)] });
        if (member.id === interaction.guild.ownerId) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modCantTargetOwner)] });
        if (!memberCanAct(interaction.member, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyUser)] });

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        if (!botCanAct(interaction.guild, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyBot)] });

        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        await member.kick(`${reason} | ${user.tag}`);

        await sendModlog(client, interaction.guild, {
            title: t.kickLog, color: MOD_COLORS.kick, t,
            target: `${member.user.tag} (${member.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
        });

        const embed = createAlertEmbed('success', user, t.kickSuccess(member.user.tag), {
            modStyle: true, targetUser: member.user, reason, t,
        });
        return interaction.editReply({ embeds: [embed] });
    },
};