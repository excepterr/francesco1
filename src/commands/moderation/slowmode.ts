import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel,
    ChannelType,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import { createModSimpleEmbed } from '../../lib/embeds';

export default {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode in a text channel.')
        .setDescriptionLocalizations(getLocalizations('commands.slowmode.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption((o) =>
            o.setName('seconds').setDescription('Seconds (0-21600).').setRequired(true)
                .setMinValue(0).setMaxValue(21600)
                .setDescriptionLocalizations(getLocalizations('commands.slowmode.secondsOption')),
        )
        .addChannelOption((o) =>
            o.setName('channel').setDescription('Channel (default: current).')
                .addChannelTypes(ChannelType.GuildText)
                .setDescriptionLocalizations(getLocalizations('commands.slowmode.channelOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const seconds = interaction.options.getInteger('seconds', true);
        const channelOpt = interaction.options.getChannel('channel');
        const channel = (channelOpt ?? interaction.channel) as TextChannel;

        if (!channel?.isTextBased()) throw new UserError(t(lang, 'errors.notFound'));

        await channel.setRateLimitPerUser(seconds);

        await interaction.editReply({
            embeds: [
                createModSimpleEmbed({
                    lang,
                    moderatorAvatarUrl: interaction.user.displayAvatarURL({ size: 256 }),
                    moderatorId: interaction.user.id,
                    titleKey: seconds === 0
                        ? 'moderation.slowmode.titleOff'
                        : 'moderation.slowmode.title',
                    descriptionKey: seconds === 0
                        ? 'moderation.slowmode.descriptionOff'
                        : 'moderation.slowmode.description',
                    vars: {
                        channel: `<#${channel.id}>`,
                        seconds: String(seconds),
                    },
                }),
            ],
        });
    },
};