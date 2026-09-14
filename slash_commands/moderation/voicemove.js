const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Перемещать участников', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('voicemove')
        .setDescription('Переместить участника в другой голосовой канал')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Канал назначения')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.MoveMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.MoveMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        }

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modMemberNotFound)] });
        if (!member.voice.channel) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNotInVoice)] });

        const channel = interaction.options.getChannel('channel');
        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        await member.voice.setChannel(channel, `${reason} | ${user.tag}`);

        await sendModlog(client, interaction.guild, {
            title: t.voicemoveLog, color: MOD_COLORS.voicemove, t,
            target: `${member.user.tag} (${member.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
            extra: [{ name: t.logFieldChannel, value: `${channel}`, inline: true }],
        });

        const embed = createAlertEmbed('success', user, t.voicemoveSuccess(member.user.tag, channel.toString()), {
            modStyle: true, targetUser: member.user, reason, t,
        });
        return interaction.editReply({ embeds: [embed] });
    },
};