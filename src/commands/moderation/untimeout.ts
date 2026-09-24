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
        .setName('untimeout')
        .setDescription('Remove a timeout from a user.')
        .setDescriptionLocalizations(getLocalizations('commands.untimeout.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((o) =>
            o.setName('user').setDescription('User.').setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.untimeout.userOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) throw new UserError(t(lang, 'moderation.notOnServer'));
        if (!member.isCommunicationDisabled()) {
            throw new UserError(t(lang, 'moderation.notTimedOut'));
        }

        await member.timeout(null);

        await interaction.editReply({
            embeds: [
                createModActionEmbed({
                    lang,
                    moderatorId: interaction.user.id,
                    targetUsername: user.username,
                    targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                    actionKey: 'Untimeout',
                    reason: null,
                }),
            ],
        });
    },
};