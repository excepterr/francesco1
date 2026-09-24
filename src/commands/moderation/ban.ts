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
        .setName('ban')
        .setDescription('Ban a user from the server.')
        .setDescriptionLocalizations(getLocalizations('commands.ban.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((o) =>
            o.setName('user').setDescription('User to ban.').setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.ban.userOption')),
        )
        .addStringOption((o) =>
            o.setName('reason').setDescription('Reason.')
                .setDescriptionLocalizations(getLocalizations('commands.ban.reasonOption')),
        )
        .addIntegerOption((o) =>
            o.setName('delete_messages').setDescription('Delete messages for N days (0-7).')
                .setMinValue(0).setMaxValue(7)
                .setDescriptionLocalizations(getLocalizations('commands.ban.deleteOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const deleteDays = interaction.options.getInteger('delete_messages') ?? 0;

        const member = await guild.members.fetch(user.id).catch(() => null);
        const me = guild.members.me!;
        const actor = await guild.members.fetch(interaction.user.id);

        if (member) assertCanModerate(actor, member, guild, me, lang);
        if (user.id === interaction.user.id) throw new UserError(t(lang, 'moderation.cantSelf'));

        await guild.bans.create(user.id, {
            reason: reason ?? `${interaction.user.username}`,
            deleteMessageSeconds: deleteDays * 86_400,
        });

        await interaction.editReply({
            embeds: [
                createModActionEmbed({
                    lang,
                    moderatorId: interaction.user.id,
                    targetUsername: user.username,
                    actionKey: 'Ban',
                    targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                    reason,
                }),
            ],
        });
    },
};