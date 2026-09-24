import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';

export default {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Role information commands.')
        .setDescriptionLocalizations(getLocalizations('commands.roles.description'))
        .addSubcommand((sub) =>
            sub
                .setName('info')
                .setDescription('Shows information about a role.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.roles.info.description'),
                )
                .addRoleOption((opt) =>
                    opt
                        .setName('role')
                        .setDescription('The role to inspect.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.roles.info.option'),
                        ),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();
        if (sub !== 'info') return;

        const role = interaction.options.getRole('role');
        if (!role) throw new UserError(t(lang, 'errors.notFound'));

        const r: any = role;
        const createdTs = Math.floor(r.createdTimestamp / 1000);
        const hex = '#' + r.color.toString(16).padStart(6, '0');

        const embed = new EmbedBuilder()
            .setDescription(`### ${r.name}`)
            .addFields(
                {
                    name: t(lang, 'roles.infoLabel'),
                    value: t(lang, 'roles.color'),
                    inline: false,
                },
                {
                    name: t(lang, 'roles.color'),
                    value: `\`${hex}\``,
                    inline: true,
                },
                {
                    name: t(lang, 'roles.created'),
                    value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`,
                    inline: true,
                },
                {
                    name: t(lang, 'roles.id'),
                    value: `\`${r.id}\``,
                },
            );

        // Красная полоса слева, если у роли есть цвет (не default)
        if (r.color !== 0) embed.setColor(r.color);

        await interaction.editReply({ embeds: [embed] });
    },
};