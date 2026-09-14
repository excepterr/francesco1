const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    botPermissions: ['Управление каналом', 'Управление ролями', 'Встраивать ссылки'],

    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Закрыть канал для отправки сообщений')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(o => o.setName('channel').setDescription('Канал (по умолчанию текущий)'))
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
            const embed = createAlertEmbed('error', user, t.modNoPerms);
            return interaction.reply({ embeds: [embed] });
        }

        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        const me = interaction.guild.members.me;
        if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
            const embed = createAlertEmbed('error', user, t.modBotNoPerms);
            return interaction.reply({ embeds: [embed] });
        }

        const overwrite = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id);
        if (overwrite && overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
            const embed = createAlertEmbed('warning', user, t.lockAlready);
            return interaction.reply({ embeds: [embed] });
        }

        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });

        await sendModlog(client, interaction.guild, {
            title: t.lockLog, color: MOD_COLORS.lock, t,
            target: `${channel} (${channel.id})`,
            moderator: `${user.tag} (${user.id})`, reason,
        });

        const perms = [
            '1. SendMessages: false',
            '2. SendMessagesInThreads: false',
        ].join('\n');

        const embed = createAlertEmbed('success', user, t.lockSuccess(channel.toString()) + '\n```\n' + perms + '\n```');
        return interaction.reply({ embeds: [embed] });
    },
};