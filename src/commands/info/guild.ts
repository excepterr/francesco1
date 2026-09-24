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
        .setName('guild')
        .setDescription('Server information commands.')
        .setDescriptionLocalizations(getLocalizations('commands.guild.description'))
        .addSubcommand((sub) =>
            sub
                .setName('icon')
                .setDescription("Shows the server's icon.")
                .setDescriptionLocalizations(
                    getLocalizations('commands.guild.icon.description'),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('banner')
                .setDescription("Shows the server's banner.")
                .setDescriptionLocalizations(
                    getLocalizations('commands.guild.banner.description'),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('info')
                .setDescription('Shows detailed information about the server.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.guild.info.description'),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();

        if (!interaction.guild) {
            throw new UserError(t(lang, 'errors.guildOnly'));
        }

        if (sub === 'icon') return handleIcon(interaction, lang);
        if (sub === 'banner') return handleBanner(interaction, lang);
        if (sub === 'info') return handleInfo(interaction, lang);
    },
};

async function handleIcon(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const guild = interaction.guild!;
    const icon = guild.iconURL({ size: 4096 });

    if (!icon) {
        throw new UserError(t(lang, 'guild.noIcon'));
    }

    const isAnimated = guild.icon?.startsWith('a_') ?? false;

    const formats: Array<'png' | 'jpg' | 'webp' | 'gif'> = ['png', 'jpg', 'webp'];
    if (isAnimated) formats.push('gif');

    const urls = formats.map((fmt) => ({
        fmt,
        url: guild.iconURL({ size: 4096, extension: fmt })!,
    }));

    const embed = new EmbedBuilder()
        .setDescription(`### ${t(lang, 'guild.iconTitle')} — ${guild.name}`)
        .setImage(icon);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        urls.map((u) =>
            new ButtonBuilder()
                .setLabel(u.fmt.toUpperCase())
                .setURL(u.url)
                .setStyle(ButtonStyle.Link),
        ),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleBanner(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const guild = interaction.guild!;

    // Принудительно fetch — баннер может быть не в кеше
    const fetched = await guild.fetch().catch(() => guild);
    const banner = fetched.bannerURL({ size: 4096 });

    if (!banner) {
        throw new UserError(t(lang, 'guild.noBanner'));
    }

    const isAnimated = fetched.banner?.startsWith('a_') ?? false;

    const formats: Array<'png' | 'jpg' | 'webp' | 'gif'> = ['png', 'jpg', 'webp'];
    if (isAnimated) formats.push('gif');

    const urls = formats.map((fmt) => ({
        fmt,
        url: fetched.bannerURL({ size: 4096, extension: fmt })!,
    }));

    const embed = new EmbedBuilder()
        .setDescription(`### ${t(lang, 'guild.bannerTitle')} — ${guild.name}`)
        .setImage(banner);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        urls.map((u) =>
            new ButtonBuilder()
                .setLabel(u.fmt.toUpperCase())
                .setURL(u.url)
                .setStyle(ButtonStyle.Link),
        ),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleInfo(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const guild = await interaction.guild!.fetch();
    const owner = await guild.fetchOwner().catch(() => null);
    const createdTs = Math.floor(guild.createdTimestamp / 1000);

    const boosts = guild.premiumSubscriptionCount ?? 0;
    const boostLevel = guild.premiumTier;

    const embed = new EmbedBuilder()
        .setDescription(`### ${guild.name}\n${t(lang, 'guild.subtitle')}`)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
            {
                name: t(lang, 'guild.boosts'),
                value: `${t(lang, 'guild.boostLevel')} ${boostLevel} (${boosts} ${t(lang, 'guild.boostsWord')})`,
                inline: true,
            },
            {
                name: t(lang, 'guild.owner'),
                value: owner ? `<@${owner.id}>` : '—',
                inline: true,
            },
            {
                name: t(lang, 'guild.members'),
                value: `${guild.memberCount}`,
            },
            {
                name: t(lang, 'guild.created'),
                value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`,
            },
            {
                name: t(lang, 'guild.moderation'),
                value: [
                    `**2FA**: ${guild.mfaLevel === 1 ? t(lang, 'yes') : t(lang, 'no')}`,
                    `**Verification**: ${['None', 'Low', 'Medium', 'High', 'Highest'][guild.verificationLevel]}`,
                    `**Media Filter**: ${['Disabled', 'Members without roles', 'All members'][guild.explicitContentFilter]}`,
                    `**Member Limit**: ${guild.maximumMembers?.toLocaleString('en-US') ?? '—'}`,
                ].join('\n'),
            },
            {
                name: t(lang, 'guild.features'),
                value: [
                    `${t(lang, 'guild.emojis')} ${guild.emojis.cache.size}`,
                    `${t(lang, 'guild.bitrate')} ${Math.round(guild.maximumBitrate / 1000)} ${t(lang, 'guild.kbps')}`,
                    `${t(lang, 'guild.filesize')} ${Math.round((guild.maximumAttachmentSize ?? 0) / 1024 / 1024)} MB`,
                ].join('\n'),
            },
            {
                name: '\u200B',
                value: `${guild.id} • <t:${Math.floor(Date.now() / 1000)}:f>`,
            },
        );

    await interaction.editReply({ embeds: [embed] });
}