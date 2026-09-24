import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import { createModSimpleEmbed } from '../../lib/embeds';

export default {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Bulk delete messages in the current channel.')
        .setDescriptionLocalizations(getLocalizations('commands.clear.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption((o) =>
            o.setName('amount').setDescription('How many (1-100).').setRequired(true)
                .setMinValue(1).setMaxValue(100)
                .setDescriptionLocalizations(getLocalizations('commands.clear.amountOption')),
        )
        .addUserOption((o) =>
            o.setName('user').setDescription('Only delete messages from this user.')
                .setDescriptionLocalizations(getLocalizations('commands.clear.userOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const amount = interaction.options.getInteger('amount', true);
        const filterUser = interaction.options.getUser('user');
        const channel = interaction.channel as TextChannel;

        if (!channel || !channel.isTextBased()) {
            throw new UserError(t(lang, 'errors.notFound'));
        }

        const messages = await channel.messages.fetch({ limit: amount });
        const toDelete = filterUser
            ? messages.filter((m) => m.author.id === filterUser.id)
            : messages;

        if (toDelete.size === 0) {
            throw new UserError(t(lang, 'moderation.clear.none'));
        }

        // bulkDelete не работает с сообщениями старше 14 дней
        const deleted = await channel.bulkDelete(toDelete, true).catch(() => null);
        if (!deleted) throw new UserError(t(lang, 'moderation.clear.tooOld'));

        await interaction.editReply({
            embeds: [
                createModSimpleEmbed({
                    lang,
                    moderatorId: interaction.user.id,
                    titleKey: 'moderation.clear.title',
                    descriptionKey: 'moderation.clear.description',
                    moderatorAvatarUrl: interaction.user.displayAvatarURL({ size: 256 }),
                    vars: { channel: `<#${channel.id}>`, count: String(deleted.size) },
                }),
            ],
        });
    },
};