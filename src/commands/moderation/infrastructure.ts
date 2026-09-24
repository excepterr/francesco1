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
        .setName('infrastructure')
        .setDescription('Server infrastructure management.')
        .setDescriptionLocalizations(getLocalizations('commands.infrastructure.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommandGroup((group) =>
            group
                .setName('channel')
                .setDescription('Channel operations.')
                .setDescriptionLocalizations(getLocalizations('commands.infrastructure.channel.description'))
                .addSubcommand((sub) =>
                    sub
                        .setName('lock')
                        .setDescription('Lock a channel (deny @everyone SendMessages).')
                        .setDescriptionLocalizations(getLocalizations('commands.infrastructure.channel.lock.description'))
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Channel (default: current).')
                                .addChannelTypes(ChannelType.GuildText)
                                .setDescriptionLocalizations(getLocalizations('commands.infrastructure.channel.lock.channelOption')),
                        )
                        .addStringOption((opt) =>
                            opt
                                .setName('reason')
                                .setDescription('Reason.')
                                .setDescriptionLocalizations(getLocalizations('commands.infrastructure.channel.lock.reasonOption')),
                        ),
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('unlock')
                        .setDescription('Unlock a channel.')
                        .setDescriptionLocalizations(getLocalizations('commands.infrastructure.channel.unlock.description'))
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Channel (default: current).')
                                .addChannelTypes(ChannelType.GuildText)
                                .setDescriptionLocalizations(getLocalizations('commands.infrastructure.channel.unlock.channelOption')),
                        ),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        if (group !== 'channel') return;

        // Дополнительная проверка прав (на случай, если default perms переопределят)
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            throw new UserError(t(lang, 'errors.noPermission'));
        }

        const channelOpt = interaction.options.getChannel('channel');
        const channel = (channelOpt ?? interaction.channel) as TextChannel;
        if (!channel?.isTextBased()) {
            throw new UserError(t(lang, 'errors.notFound'));
        }

        const reason = interaction.options.getString('reason') ?? null;

        // ============ LOCK ============
        if (sub === 'lock') {
            await channel.permissionOverwrites.edit(
                interaction.guild!.roles.everyone.id,
                { SendMessages: false },
                { reason: reason ?? undefined },
            );

            await interaction.editReply({
                embeds: [
                    createModSimpleEmbed({
                        lang,
                        moderatorId: interaction.user.id,
                        titleKey: 'moderation.channelLock.title',
                        descriptionKey: 'moderation.channelLock.description',
                        moderatorAvatarUrl: interaction.user.displayAvatarURL({ size: 256 }),
                        vars: { channel: `#${channel.name}` },
                        reason,
                    }),
                ],
            });
            return;
        }

        // ============ UNLOCK ============
        if (sub === 'unlock') {
            await channel.permissionOverwrites.edit(
                interaction.guild!.roles.everyone.id,
                { SendMessages: null },
            );

            await interaction.editReply({
                embeds: [
                    createModSimpleEmbed({
                        lang,
                        moderatorId: interaction.user.id,
                        titleKey: 'moderation.channelUnlock.title',
                        descriptionKey: 'moderation.channelUnlock.description',
                        moderatorAvatarUrl: interaction.user.displayAvatarURL({ size: 256 }),
                        vars: { channel: `#${channel.name}` },
                        reason: null,
                    }),
                ],
            });
        }
    },
};