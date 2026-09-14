const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { getSettings } = require('../../utils/settings');

const INVITE_EMOJI = '<:user:1547749959967703131>';

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Информация о канале')
        .addSubcommand(s => s.setName('info').setDescription('Информация о канале')
            .addChannelOption(o => o.setName('channel').setDescription('Канал (по умолчанию — текущий)'))),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;

        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const createdTs = Math.floor(channel.createdTimestamp / 1000);

        let inviteCount = 0;
        if ([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement].includes(channel.type)) {
            const invites = await channel.fetchInvites().catch(() => null);
            if (invites) inviteCount = invites.size;
        }

        const embed = new EmbedBuilder()
            .setTitle(`#${channel.name} (${channel.id})`)
            .addFields(
                { name: t.channelInfoCategory, value: channel.parent?.name ?? t.none, inline: true },
                { name: t.channelInfoTopic, value: channel.topic ?? t.none, inline: true },
                { name: t.channelInfoInvites, value: `${INVITE_EMOJI} ${inviteCount}`, inline: true },
                { name: t.channelInfoCreated, value: `<t:${createdTs}:f> (<t:${createdTs}:R>)`, inline: true },
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};