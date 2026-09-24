import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';

export default {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("Shows a user's avatar.")
        .setDescriptionLocalizations(getLocalizations('commands.avatar.description'))
        .addUserOption((opt) =>
            opt
                .setName('user')
                .setDescription('The user whose avatar to show.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.avatar.userOption'),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const target = interaction.options.getUser('user') ?? interaction.user;

        const isAnimated = target.avatar?.startsWith('a_') ?? false;

        // Форматы для кнопок
        const formats: Array<'png' | 'jpg' | 'webp' | 'gif'> = [
            'png',
            'jpg',
            'webp',
        ];
        if (isAnimated) formats.push('gif');

        const urls = formats.map((fmt) => ({
            fmt,
            url: target.displayAvatarURL({ size: 4096, extension: fmt }),
        }));

        const embed = new EmbedBuilder()
            .setDescription(
                `### ${t(lang, 'avatar.title')} — ${target.username}`,
            )
            .setImage(target.displayAvatarURL({ size: 4096 }));

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            urls.map((u) =>
                new ButtonBuilder()
                    .setLabel(u.fmt.toUpperCase())
                    .setURL(u.url)
                    .setStyle(ButtonStyle.Link),
            ),
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row],
        });
    },
};