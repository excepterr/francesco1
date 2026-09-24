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
        .setName('role')
        .setDescription('Add or remove a role from a member.')
        .setDescriptionLocalizations(getLocalizations('commands.role.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand((sub) =>
            sub
                .setName('add')
                .setDescription('Add a role.')
                .setDescriptionLocalizations(getLocalizations('commands.role.add.description'))
                .addUserOption((o) =>
                    o.setName('user').setDescription('User.').setRequired(true),
                )
                .addRoleOption((o) =>
                    o.setName('role').setDescription('Role.').setRequired(true),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remove a role.')
                .setDescriptionLocalizations(getLocalizations('commands.role.remove.description'))
                .addUserOption((o) =>
                    o.setName('user').setDescription('User.').setRequired(true),
                )
                .addRoleOption((o) =>
                    o.setName('role').setDescription('Role.').setRequired(true),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guild = interaction.guild!;
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user', true);
        const role = interaction.options.getRole('role', true);

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) throw new UserError(t(lang, 'moderation.notOnServer'));

        const me = guild.members.me!;
        if (role.position >= me.roles.highest.position) {
            throw new UserError(t(lang, 'moderation.roleTooHigh'));
        }

        if (sub === 'add') {
            await member.roles.add(role);
            await interaction.editReply({
                embeds: [
                    createModActionEmbed({
                        lang,
                        moderatorId: interaction.user.id,
                        targetUsername: user.username,
                        targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                        actionKey: 'RoleAdd',
                        reason: null,
                        extra: { role: role.name },
                    }),
                ],
            });
        } else {
            await member.roles.remove(role);
            await interaction.editReply({
                embeds: [
                    createModActionEmbed({
                        lang,
                        moderatorId: interaction.user.id,
                        targetUsername: user.username,
                        targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                        actionKey: 'RoleRemove',
                        reason: null,
                        extra: { role: role.name },
                    }),
                ],
            });
        }
    },
};