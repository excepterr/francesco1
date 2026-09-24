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
        .setName('nickname')
        .setDescription("Change a member's nickname.")
        .setDescriptionLocalizations(getLocalizations('commands.nickname.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addUserOption((o) =>
            o.setName('user').setDescription('User.').setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.nickname.userOption')),
        )
        .addStringOption((o) =>
            o.setName('name').setDescription('New nickname (empty to reset).')
                .setMaxLength(32)
                .setDescriptionLocalizations(getLocalizations('commands.nickname.nameOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const name = interaction.options.getString('name');

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) throw new UserError(t(lang, 'moderation.notOnServer'));

        const me = guild.members.me!;
        if (member.roles.highest.position >= me.roles.highest.position) {
            throw new UserError(t(lang, 'moderation.hierarchyBot'));
        }

        await member.setNickname(name ?? null);

        await interaction.editReply({
            embeds: [
                createModActionEmbed({
                    lang,
                    moderatorId: interaction.user.id,
                    targetUsername: user.username,
                    targetAvatarUrl: user.displayAvatarURL({ size: 256 }),
                    actionKey: name ? 'NicknameSet' : 'NicknameReset',
                    reason: null,
                    extra: name ? { name } : {},
                }),
            ],
        });
    },
};