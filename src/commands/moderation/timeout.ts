import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import { assertCanModerate, parseDuration } from '../../lib/moderation';
import { createModActionEmbed } from '../../lib/embeds';

const MAX_MS = 28 * 86_400_000;

export default {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user.')
        .setDescriptionLocalizations(getLocalizations('commands.timeout.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((o) =>
            o.setName('user').setDescription('User.').setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.timeout.userOption')),
        )
        .addStringOption((o) =>
            o.setName('duration').setDescription('e.g. 5m, 1h, 2d (max 28d).').setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.timeout.durationOption')),
        )
        .addStringOption((o) =>
            o.setName('reason').setDescription('Reason.')
                .setDescriptionLocalizations(getLocalizations('commands.timeout.reasonOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const durationStr = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason') ?? undefined;

        const ms = parseDuration(durationStr);
        if (!ms) throw new UserError(t(lang, 'moderation.invalidDuration'));
        if (ms > MAX_MS) throw new UserError(t(lang, 'moderation.tooLong'));

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) throw new UserError(t(lang, 'moderation.notOnServer'));

        const me = guild.members.me!;
        const actor = await guild.members.fetch(interaction.user.id);
        assertCanModerate(actor, member, guild, me, lang);

        await member.timeout(ms, reason);

        await interaction.editReply({
            embeds: [
                createModActionEmbed({
                    lang,
                    moderatorId: interaction.user.id,
                    targetUsername: user.username,
                    targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                    actionKey: 'Timeout',
                    reason,
                    extra: { duration: durationStr },
                }),
            ],
        });
    },
};