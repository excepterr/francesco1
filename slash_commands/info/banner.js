const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const COLOR = 0x2f3236;

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Показывает баннер пользователя')
        .addUserOption(opt =>
            opt.setName('member').setDescription('Выберите пользователя (по умолчанию ваш)').setRequired(false)
        ),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;

        const target = interaction.options.getUser('member') || interaction.user;
        const fetched = await client.users.fetch(target.id, { force: true }).catch(() => null);

        if (!fetched?.banner) {
            const embed = createAlertEmbed('warning', interaction.user, t.bannerNotFound, {
                action: t.alertActionBanner,
                thumbnail: target.displayAvatarURL({ size: 256 }),
            });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const bannerURL = fetched.bannerURL({ size: 4096 });

        const embed = new EmbedBuilder()
            .setTitle(`${fetched.username} (ID: ${fetched.id})`)
            .setURL(bannerURL)
            .setColor(fetched.accentColor || COLOR)
            .setImage(bannerURL)
            .setTimestamp();

        return interaction.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } });
    },
};