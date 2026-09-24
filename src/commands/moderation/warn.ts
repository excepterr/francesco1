import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import * as warnDb from '../../lib/warnings';
import { createModActionEmbed } from '../../lib/embeds';

export default {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Manage user warnings.')
        .setDescriptionLocalizations(getLocalizations('commands.warn.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand((sub) =>
            sub
                .setName('add')
                .setDescription('Warn a user.')
                .setDescriptionLocalizations(getLocalizations('commands.warn.add.description'))
                .addUserOption((o) =>
                    o.setName('user').setDescription('User.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.warn.add.userOption')),
                )
                .addStringOption((o) =>
                    o.setName('reason').setDescription('Reason.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.warn.add.reasonOption')),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('list')
                .setDescription('List warnings of a user.')
                .setDescriptionLocalizations(getLocalizations('commands.warn.list.description'))
                .addUserOption((o) =>
                    o.setName('user').setDescription('User.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.warn.list.userOption')),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remove a warning by ID.')
                .setDescriptionLocalizations(getLocalizations('commands.warn.remove.description'))
                .addIntegerOption((o) =>
                    o.setName('id').setDescription('Warning ID.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.warn.remove.idOption')),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('clear')
                .setDescription('Clear all warnings of a user.')
                .setDescriptionLocalizations(getLocalizations('commands.warn.clear.description'))
                .addUserOption((o) =>
                    o.setName('user').setDescription('User.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.warn.clear.userOption')),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        // ===== ADD =====
        if (sub === 'add') {
            const user = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason', true);

            const warning = await warnDb.addWarning(guildId, user.id, interaction.user.id, reason);
            if (!warning) throw new UserError(t(lang, 'errors.generic'));

            await interaction.editReply({
                embeds: [
                    createModActionEmbed({
                        lang,
                        moderatorId: interaction.user.id,
                        targetUsername: user.username,
                        targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                        actionKey: 'WarnAdd',
                        reason,
                        extra: { id: String(warning.id) },
                    }),
                ],
            });
            return;
        }

        // ===== LIST =====
        if (sub === 'list') {
            const user = interaction.options.getUser('user', true);
            const list = await warnDb.listWarnings(guildId, user.id);

            if (!list.length) {
                await interaction.editReply({
                    content: t(lang, 'moderation.warn.empty', { user: user.username }),
                });
                return;
            }

            const lines = list.slice(0, 20).map((w) => {
                const ts = Math.floor(w.created_at / 1000);
                return `**#${w.id}** <@${w.moderator_id}> • <t:${ts}:R>\n> ${w.reason ?? '—'}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(t(lang, 'moderation.warn.listTitle', { user: user.username }))
                .setDescription(lines.join('\n\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ===== REMOVE =====
        if (sub === 'remove') {
            const id = interaction.options.getInteger('id', true);
            const ok = await warnDb.removeWarning(guildId, id);
            if (!ok) throw new UserError(t(lang, 'errors.generic'));

            await interaction.editReply({
                content: t(lang, 'moderation.warn.removed', { id }),
            });
            return;
        }

        // ===== CLEAR =====
        if (sub === 'clear') {
            const user = interaction.options.getUser('user', true);
            const ok = await warnDb.clearWarnings(guildId, user.id);
            if (!ok) throw new UserError(t(lang, 'errors.generic'));

            await interaction.editReply({
                content: t(lang, 'moderation.warn.cleared', { user: user.username }),
            });
        }
    },
};