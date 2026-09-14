const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const COLOR = 0x2f3236;

const VERIFICATION_KEYS = { 0: 'none', 1: 'low', 2: 'medium', 3: 'high', 4: 'veryHigh' };
const MEDIA_FILTER_KEYS = { 0: 'disabled', 1: 'noRole', 2: 'allMembers' };

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('guild')
        .setDescription('Информация о сервере')
        .addSubcommand(sub =>
            sub.setName('info').setDescription('Информация о сервере')
        )
        .addSubcommand(sub =>
            sub.setName('icon').setDescription('Иконка сервера')
        ),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;
        const guild = interaction.guild;
        await guild.fetch().catch(() => null);

        if (sub === 'info') {
            const owner = await guild.fetchOwner().catch(() => null);
            const ownerValue = owner ? `<@${owner.id}>` : (t.none ?? 'Нет');
            const createdTs = Math.floor(guild.createdTimestamp / 1000);
            const verification = t.verificationLevels?.[VERIFICATION_KEYS[guild.verificationLevel]] ?? (t.verificationLevels?.none ?? 'Нет');
            const mediaFilter = t.mediaFilterLevels?.[MEDIA_FILTER_KEYS[guild.explicitContentFilter]] ?? (t.mediaFilterLevels?.disabled ?? 'Нет');
            const twoFA = guild.mfaLevel === 1 ? (t.enabled ?? 'включено') : (t.disabled ?? 'выключено');
            const memberLimit = (guild.maximumMembers ?? 0).toLocaleString();
            const emojiCount = guild.emojis.cache.size;
            const bitrate = Math.round((guild.maximumBitrate ?? 0) / 1000);
            const fileSize = Math.round((guild.maximumAttachmentSize ?? 0) / 1024 / 1024);

            const embed = new EmbedBuilder()
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ size: 512 }))
                .setDescription(t.serverInfoSubtitle ?? 'Информация о сервере')
                .addFields(
                    { name: t.serverInfoBoosts ?? 'Бусты', value: `${t.serverInfoLevel ?? 'Уровень'} ${guild.premiumTier} (${guild.premiumSubscriptionCount} ${t.serverInfoBoostsWord ?? 'бустов'})`, inline: true },
                    { name: t.serverInfoOwner ?? 'Владелец', value: ownerValue, inline: true },
                    { name: t.serverInfoMembers ?? 'Участники', value: `${guild.memberCount}` },
                    { name: t.serverInfoCreated ?? 'Дата создания', value: `<t:${createdTs}:f> (<t:${createdTs}:R>)` },
                    {
                        name: t.serverInfoModeration ?? 'Модерация',
                        value: `**2FA:** ${twoFA}\n**Verification:** ${verification}\n**Media Filter:** ${mediaFilter}\n**Member Limit:** ${memberLimit}`,
                    },
                    {
                        name: t.serverInfoFeatures ?? 'Функции',
                        value: `**${t.serverInfoEmojis ?? 'Эмодзи'}** ${emojiCount}\n**${t.serverInfoBitrate ?? 'Битрейт'}** ${bitrate} ${t.serverInfoKbps ?? 'Кбит/с'}\n**${t.serverInfoFileSize ?? 'Размер файла'}** ${fileSize} ${t.serverInfoMb ?? 'МБ'}`,
                    },
                )
                .setColor(COLOR)
                .setFooter({ text: guild.id })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } });
        }

        if (sub === 'icon') {
            const iconURL = guild.iconURL({ size: 4096 });
            if (!iconURL) {
                const embed = createAlertEmbed('warning', user, t.serverIconNotFound, {
                    action: t.alertActionServerIcon,
                    thumbnail: guild.iconURL({ size: 256 }) ?? null,
                });
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${guild.name} (ID: ${guild.id})`)
                .setURL(iconURL)
                .setColor(COLOR)
                .setImage(iconURL)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } });
        }
    },
};