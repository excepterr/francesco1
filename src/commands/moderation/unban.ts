import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import { createModActionEmbed } from '../../lib/embeds';

export default {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user.')
        .setDescriptionLocalizations(getLocalizations('commands.unban.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption((o) =>
            o.setName('user_id').setDescription('User ID.').setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.unban.userIdOption')),
        )
        .addStringOption((o) =>
            o.setName('reason').setDescription('Reason.')
                .setDescriptionLocalizations(getLocalizations('commands.unban.reasonOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guild = interaction.guild!;
        const userId = interaction.options.getString('user_id', true).trim();
        const reason = interaction.options.getString('reason') ?? undefined;

        if (!/^\d{17,20}$/.test(userId)) {
            throw new UserError(t(lang, 'moderation.invalidId'));
        }

        const ban = await guild.bans.fetch(userId).catch(() => null);
        if (!ban) throw new UserError(t(lang, 'moderation.notBanned'));

        await guild.bans.remove(userId, reason);

        await interaction.editReply({
            embeds: [
                createModActionEmbed({
                    lang,
                    moderatorId: interaction.user.id,
                    targetUsername: ban.user.username,
                    targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                    actionKey: 'Unban',
                    reason,
                }),
            ],
        });
    },
};