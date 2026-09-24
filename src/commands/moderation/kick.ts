import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import { assertCanModerate } from '../../lib/moderation';
import { createModActionEmbed } from '../../lib/embeds';

export default {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server.')
        .setDescriptionLocalizations(getLocalizations('commands.kick.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption((o) =>
            o.setName('user').setDescription('User to kick.').setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.kick.userOption')),
        )
        .addStringOption((o) =>
            o.setName('reason').setDescription('Reason.')
                .setDescriptionLocalizations(getLocalizations('commands.kick.reasonOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) throw new UserError(t(lang, 'moderation.notOnServer'));

        const me = guild.members.me!;
        const actor = await guild.members.fetch(interaction.user.id);
        assertCanModerate(actor, member, guild, me, lang);

        await member.kick(reason);

        await interaction.editReply({
            embeds: [
                createModActionEmbed({
                    lang,
                    moderatorId: interaction.user.id,
                    targetUsername: user.username,
                    targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                    actionKey: 'Kick',
                    reason,
                }),
            ],
        });
    },
};