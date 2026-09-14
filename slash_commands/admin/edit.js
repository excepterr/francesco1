const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, MessageFlags,
} = require('discord.js');
const { getSettings, updateSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const COLOR = 0x2f3236;

function buildMainMenu(t, userId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`edit:${userId}`)
            .setPlaceholder(t.selectModulePlaceholder)
            .setDisabled(disabled)
            .addOptions(
                { label: t.moduleLang, description: t.moduleLangDesc, value: 'lang' },
                { label: t.modulePrefix, description: t.modulePrefixDesc, value: 'prefix' },
            )
    );
}

function buildMainEmbed(t, user) {
    return new EmbedBuilder()
        .setTitle(t.editTitle)
        .setDescription(t.editDescription)
        .addFields({ name: t.editWarningTitle, value: t.editWarningText })
        .setFooter({ text: `${t.request} ${user.username}`, iconURL: user.displayAvatarURL() })
        .setTimestamp()
        .setColor(COLOR);
}

function buildLangPanel(t, userId) {
    const embed = new EmbedBuilder()
        .setTitle(t.moduleLang)
        .addFields({ name: t.editWarningTitle, value: t.editLangText })
        .setColor(COLOR);

    const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`edit_lang:${userId}`)
            .setPlaceholder(t.selectLangPlaceholder)
            .addOptions(
                { label: 'Русский', value: 'ru', emoji: '🇷🇺' },
                { label: 'English', value: 'en', emoji: '🇬🇧' },
                { label: '日本語', value: 'ja', emoji: '🇯🇵' },
            )
    );

    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`edit_back:${userId}`)
            .setLabel(t.btnBack)
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [rowMenu, rowButtons] };
}

function buildPrefixPanel(t, userId, currentPrefix) {
    const embed = new EmbedBuilder()
        .setTitle(t.modulePrefix)
        .setDescription(`${t.editPrefixTitle} \`${currentPrefix}\``)
        .addFields({ name: t.editWarningTitle, value: t.editPrefixText })
        .setColor(COLOR);

    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`edit_open_prefix_modal:${userId}`)
            .setLabel(t.btnPrefix)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`edit_back:${userId}`)
            .setLabel(t.btnBack)
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [rowButtons] };
}

async function openPanel(client, interaction) {
    const user = interaction.user;
    const settings = await getSettings(interaction.guildId);
    const t = client.locales[settings.lang] ?? client.locales.ru;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        const embed = createAlertEmbed('error', user, t.admpermissions, {
            action: t.alertActionPermissions,
        });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        embeds: [buildMainEmbed(t, user)],
        components: [buildMainMenu(t, user.id)],
        allowedMentions: { parse: [], repliedUser: false },
    });
}

module.exports = {
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('edit')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    slashExecute: openPanel,

    components: {
        edit: async (client, interaction, session) => {
            const choice = interaction.values[0];
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;

            if (choice === 'lang') {
                const panel = buildLangPanel(t, interaction.user.id);
                return interaction.update(panel);
            }

            if (choice === 'prefix') {
                const settings = await getSettings(interaction.guildId);
                const panel = buildPrefixPanel(t, interaction.user.id, settings.prefix);
                return interaction.update(panel);
            }
        },

        edit_back: async (client, interaction, session) => {
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            return interaction.update({
                embeds: [buildMainEmbed(t, interaction.user)],
                components: [buildMainMenu(t, interaction.user.id)]
            });
        },

        edit_open_prefix_modal: async (client, interaction, session) => {
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const modal = new ModalBuilder()
                .setCustomId(`edit_prefix_modal_submit:${interaction.user.id}`)
                .setTitle(t.prefixModalTitle)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('prefix_input')
                            .setLabel(t.prefixInputLabel)
                            .setPlaceholder(t.prefixInputPlaceholder)
                            .setMinLength(1)
                            .setMaxLength(5)
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );
            return interaction.showModal(modal);
        },

        edit_lang: async (client, interaction, session) => {
            const lang = interaction.values[0];
            await updateSettings(interaction.guildId, { lang });
            const t = client.locales[lang] ?? client.locales.ru;

            const panel = buildLangPanel(t, interaction.user.id);
            await interaction.update(panel);

            const alertEmbed = createAlertEmbed('success', interaction.user, t.langChanged, {
                action: t.alertActionLang,
            });
            return interaction.followUp({
                embeds: [alertEmbed],
                flags: MessageFlags.Ephemeral
            });
        },

        edit_prefix_modal_submit: async (client, interaction, session) => {
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const prefix = interaction.fields.getTextInputValue('prefix_input').trim();

            if (!prefix) {
                const errEmbed = createAlertEmbed('error', interaction.user, t.prefixnull, {
                    action: t.alertActionPrefix,
                });
                return interaction.reply({
                    embeds: [errEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }

            await updateSettings(interaction.guildId, { prefix });

            const panel = buildPrefixPanel(t, interaction.user.id, prefix);
            await interaction.update(panel);

            const alertEmbed = createAlertEmbed('success', interaction.user, t.prefixChanged(prefix), {
                action: t.alertActionPrefix,
            });
            return interaction.followUp({
                embeds: [alertEmbed],
                flags: MessageFlags.Ephemeral
            });
        },
    },
};