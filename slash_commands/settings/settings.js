const {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, SeparatorSpacingSize,
} = require('discord.js');
const { getSettings, getDisabledCategories, toggleCategory } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const CATEGORIES = ['admin', 'info', 'fun', 'interactions', 'moderation'];
const PROTECTED = ['settings']; // нельзя выключить

async function buildPanel(guildId, t) {
    const disabled = await getDisabledCategories(guildId);

    const container = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# ${t.settingsTitle ?? 'Настройки сервера'}`),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t.settingsDesc ?? 'Нажми на категорию, чтобы выключить или включить её.'),
        );

    for (let i = 0; i < CATEGORIES.length; i += 3) {
        const row = new ActionRowBuilder();
        for (const cat of CATEGORIES.slice(i, i + 3)) {
            const isDisabled = disabled.includes(cat);
            const isProtected = PROTECTED.includes(cat);
            const rawLabel = t.categories?.[cat] ?? cat;
            const label = rawLabel.replace(/<[^>]+>\s*/, '').trim() || cat;

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`settings_cat:${cat}`)
                    .setLabel(label)
                    .setStyle(isProtected ? ButtonStyle.Secondary : (isDisabled ? ButtonStyle.Danger : ButtonStyle.Success))
                    .setDisabled(isProtected),
            );
        }
        container.addActionRowComponents(row);
    }

    const ts = Math.floor(Date.now() / 1000);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`),
    );

    return container;
}

async function handleToggle(client, interaction) {
    await interaction.deferUpdate();

    const { lang } = await getSettings(interaction.guildId);
    const t = client.locales[lang] ?? client.locales.ru;

    const category = interaction.customId.split(':')[1];
    if (!CATEGORIES.includes(category)) return;

    if (PROTECTED.includes(category)) {
        return interaction.followUp({
            content: t.categoryProtected ?? 'эту категорию нельзя отключить.',
            flags: MessageFlags.Ephemeral,
        });
    }

    await toggleCategory(interaction.guildId, category);

    const container = await buildPanel(interaction.guildId, t);

    return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
module.exports = {
    cooldown: 4,
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Настройки сервера')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const embed = createAlertEmbed('error', interaction.user, t.modNoPerms, { action: t.settingsTitle });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const container = await buildPanel(interaction.guildId, t);

        return interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
    },

    components: {
        settings_cat: handleToggle,
    },
};