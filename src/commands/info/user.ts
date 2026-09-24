import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('User information commands.')
        .setDescriptionLocalizations(getLocalizations('commands.user.description'))
        .addSubcommand((sub) =>
            sub
                .setName('info')
                .setDescription('Shows information about a user.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.user.info.description'),
                )
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('The user to inspect.')
                        .setDescriptionLocalizations(
                            getLocalizations('commands.user.info.option'),
                        ),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();
        if (sub !== 'info') return;

        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = interaction.guild
            ? await interaction.guild.members.fetch(target.id).catch(() => null)
            : null;

        const accountTs = Math.floor(target.createdTimestamp / 1000);
        const joinedTs = member?.joinedTimestamp
            ? Math.floor(member.joinedTimestamp / 1000)
            : null;

        const roles = member?.roles.cache
            .filter((r) => r.id !== interaction.guild!.id)
            .map((r) => `<@&${r.id}>`)
            .slice(0, 20)
            .join(' ') || t(lang, 'user.noRoles');

        const embed = new EmbedBuilder()
            .setDescription(`### ${target.username} (${target.id})`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: t(lang, 'user.joined'),
                    value: joinedTs ? `<t:${joinedTs}:D> (<t:${joinedTs}:R>)` : '—',
                    inline: true,
                },
                {
                    name: t(lang, 'user.created'),
                    value: `<t:${accountTs}:D> (<t:${accountTs}:R>)`,
                    inline: true,
                },
                {
                    name: t(lang, 'user.roles'),
                    value: roles,
                },
                {
                    name: t(lang, 'user.requestedBy'),
                    value: `${interaction.user.username} • <t:${Math.floor(Date.now() / 1000)}:f>`,
                },
            );

        await interaction.editReply({ embeds: [embed] });
    },
};