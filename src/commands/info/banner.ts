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
        .setName('banner')
        .setDescription("Shows a user's banner.")
        .setDescriptionLocalizations(getLocalizations('commands.banner.description'))
        .addUserOption((opt) =>
            opt
                .setName('user')
                .setDescription('The user whose banner to show.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.banner.userOption'),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const target = interaction.options.getUser('user') ?? interaction.user;

        // Принудительно запрашиваем свежие данные — иначе баннер может быть не в кеше
        const user = await interaction.client.users
            .fetch({ user: target.id, force: true })
            .catch(() => null);

        const banner = user?.bannerURL({ size: 4096 });

        if (!banner) {
            throw new UserError(
                t(lang, 'banner.noBanner', { user: target.username }),
            );
        }

        const isAnimated = user?.banner?.startsWith('a_') ?? false;

        const formats: Array<'png' | 'jpg' | 'webp' | 'gif'> = [
            'png',
            'jpg',
            'webp',
        ];
        if (isAnimated) formats.push('gif');

        const urls = formats.map((fmt) => ({
            fmt,
            url: user!.bannerURL({ size: 4096, extension: fmt })!,
        }));

        const embed = new EmbedBuilder()
            .setDescription(
                `### ${t(lang, 'banner.title')} — ${target.username}`,
            )
            .setImage(banner);

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