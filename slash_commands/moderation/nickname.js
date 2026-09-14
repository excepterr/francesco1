const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog, memberCanAct, botCanAct } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Управление никнеймами', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('nickname')
        .setDescription('Изменить никнейм участника')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(o => o.setName('nickname').setDescription('Новый ник (пусто — сброс)').setMaxLength(32)),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modMemberNotFound)] });
        if (member.id === interaction.guild.ownerId) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modCantTargetOwner)] });
        if (!memberCanAct(interaction.member, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyUser)] });

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        if (!botCanAct(interaction.guild, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyBot)] });

        const nickname = interaction.options.getString('nickname');
        await member.setNickname(nickname);

        const reason = nickname ?? t.nicknameResetReason;

        await sendModlog(client, interaction.guild, {
            title: t.nicknameLog, color: MOD_COLORS.nickname, t,
            target: `${member.user.tag} (${member.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
            extra: nickname ? [{ name: t.logFieldName, value: nickname, inline: true }] : [],
        });

        const text = nickname ? t.nicknameSuccess(member.user.tag, nickname) : t.nicknameReset(member.user.tag);
        const embed = createAlertEmbed('success', user, text, {
            modStyle: true, targetUser: member.user, reason, t,
        });
        return interaction.editReply({ embeds: [embed] });
    },
};