const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog, memberCanAct, botCanAct, formatDuration } = require('../../utils/moderation');

const UNITS = { seconds: 1000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
const MAX_TIMEOUT = 28 * 86_400_000;

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Отправлять участников в тайм-аут', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Выдать тайм-аут участнику')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Количество').setMinValue(1).setMaxValue(40320).setRequired(true))
        .addStringOption(o => o.setName('unit').setDescription('Единица').setRequired(true)
            .addChoices(
                { name: 'секунды', value: 'seconds' },
                { name: 'минуты', value: 'minutes' },
                { name: 'часы', value: 'hours' },
                { name: 'дни', value: 'days' },
            ))
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modMemberNotFound)] });
        if (member.id === user.id) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modCantTargetSelf)] });
        if (member.id === interaction.guild.ownerId) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modCantTargetOwner)] });
        if (!memberCanAct(interaction.member, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyUser)] });

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        if (!botCanAct(interaction.guild, member)) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modHierarchyBot)] });

        const amount = interaction.options.getInteger('amount');
        const unit = interaction.options.getString('unit');
        const duration = amount * UNITS[unit];

        if (duration > MAX_TIMEOUT) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.timeoutTooLong)] });
        }

        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        await member.timeout(duration, `${reason} | ${user.tag}`);

        const durationText = formatDuration(duration);

        await sendModlog(client, interaction.guild, {
            title: t.timeoutLog, color: MOD_COLORS.timeout, t,
            target: `${member.user.tag} (${member.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
            extra: [{ name: t.modDuration, value: durationText, inline: true }],
        });

        const embed = createAlertEmbed('success', user, t.timeoutSuccess(member.user.tag, durationText), {
            modStyle: true, targetUser: member.user, reason, t,
        });
        return interaction.editReply({ embeds: [embed] });
    },
};