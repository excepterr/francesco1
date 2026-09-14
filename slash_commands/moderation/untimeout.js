const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Отправлять участников в тайм-аут', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Снять тайм-аут с участника')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        }

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modMemberNotFound)] });

        if (!member.isCommunicationDisabled()) {
            return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.untimeoutAlready)] });
        }

        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        await member.timeout(null, `${reason} | ${user.tag}`);

        await sendModlog(client, interaction.guild, {
            title: t.untimeoutLog, color: MOD_COLORS.untimeout, t,
            target: `${member.user.tag} (${member.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
        });

        const embed = createAlertEmbed('success', user, t.untimeoutSuccess(member.user.tag), {
            modStyle: true, targetUser: member.user, reason, t,
        });
        return interaction.editReply({ embeds: [embed] });
    },
};