const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Управление каналом', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Установить медленный режим')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(o => o.setName('seconds').setDescription('Секунды (0 — отключить, макс 21600)').setMinValue(0).setMaxValue(21600).setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Канал (по умолчанию — текущий)')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        const me = interaction.guild.members.me;
        if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modBotNoPerms)] });
        }

        const seconds = interaction.options.getInteger('seconds');
        await channel.setRateLimitPerUser(seconds);

        await sendModlog(client, interaction.guild, {
            title: t.slowmodeLog, color: MOD_COLORS.slowmode, t,
            target: `${channel} (${channel.id})`,
            moderator: `${user.tag} (${user.id})`,
            reason: seconds === 0 ? t.slowmodeOffReason : `${seconds}s`,
            extra: seconds > 0 ? [{ name: t.modDuration, value: `${seconds}s`, inline: true }] : [],
        });

        const text = seconds === 0 ? t.slowmodeOff : t.slowmodeSuccess(seconds);
        const embed = createAlertEmbed('success', user, text);
        return interaction.editReply({ embeds: [embed] });
    },
};