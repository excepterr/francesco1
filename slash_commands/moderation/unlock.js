const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['Управление каналом', 'Управление ролями', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Открыть канал для отправки сообщений')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(o => o.setName('channel').setDescription('Канал (по умолчанию — текущий)'))
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
            const embed = createAlertEmbed('error', user, t.modNoPerms);
            return interaction.editReply({ embeds: [embed] });
        }

        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        const me = interaction.guild.members.me;
        if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
            const embed = createAlertEmbed('error', user, t.modBotNoPerms);
            return interaction.editReply({ embeds: [embed] });
        }

        const overwrite = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id);
        const isLocked = overwrite && overwrite.deny.has(PermissionFlagsBits.SendMessages);
        if (!isLocked) {
            const embed = createAlertEmbed('warning', user, t.unlockAlready);
            return interaction.editReply({ embeds: [embed] });
        }

        const reason = interaction.options.getString('reason') ?? t.modNoReason;
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });

        await sendModlog(client, interaction.guild, {
            title: t.unlockLog, color: MOD_COLORS.unlock, t,
            target: `${channel} (${channel.id})`,
            moderator: `${user.tag} (${user.id})`, reason,
        });

        const perms = [
            '1. SendMessages: null',
            '2. SendMessagesInThreads: null',
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle(t.unlockLog)
            .setDescription(`${user}, ${t.unlockSuccess(channel.toString())}\n\`\`\`\n${perms}\n\`\`\``)
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};