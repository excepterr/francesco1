const {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, SeparatorSpacingSize,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const log = require('../../utils/logging');

// ─── панель ───
async function buildLoggingPanel(guildId, t) {
    const cfg = await log.getLoggingSettings(guildId);
    const status = cfg.enabled ? t.logEnabled : t.logDisabled;
    const statusEmoji = cfg.enabled ? '🟢' : '🔴';
    const channel = cfg.channelId ? `<#${cfg.channelId}>` : `*${t.logChannelNotSet}*`;

    const container = new ContainerBuilder().setAccentColor(null);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${t.alertActionLogging}`),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${t.logStatusField}: ${statusEmoji} **${status}**\n${t.logChannelField}: ${channel}`
        ),
    );

    // 6 категорий — 2 ряда по 3
    for (let i = 0; i < log.CATEGORIES.length; i += 3) {
        const row = new ActionRowBuilder();
        for (const cat of log.CATEGORIES.slice(i, i + 3)) {
            const on = log.isCategoryEnabled(cfg.events, cat);
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`logging_cat:${cat}`)
                    .setLabel(t[`logCat_${cat}`] ?? cat)
                    .setStyle(on ? ButtonStyle.Success : ButtonStyle.Danger),
            );
        }
        container.addActionRowComponents(row);
    }

    // toggle
    const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('logging_toggle')
            .setLabel(cfg.enabled ? t.logBtnDisable : t.logBtnEnable)
            .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    );
    container.addActionRowComponents(toggleRow);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`),
    );

    return container;
}

// ─── компоненты ───
async function handleToggle(client, interaction) {
    await interaction.deferUpdate();

    const { lang } = await getSettings(interaction.guildId);
    const t = client.locales[lang] ?? client.locales.ru;

    const cfg = await log.getLoggingSettings(interaction.guildId);
    await log.setLoggingEnabled(interaction.guildId, !cfg.enabled);

    const container = await buildLoggingPanel(interaction.guildId, t);
    return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

async function handleCategory(client, interaction) {
    await interaction.deferUpdate();

    const { lang } = await getSettings(interaction.guildId);
    const t = client.locales[lang] ?? client.locales.ru;

    const category = interaction.customId.split(':')[1];
    if (!log.CATEGORIES.includes(category)) return;

    await log.toggleCategory(interaction.guildId, category);

    const container = await buildLoggingPanel(interaction.guildId, t);
    return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

module.exports = {
    cooldown: 4,
    botPermissions: ['Встраивать ссылки'],

    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Управление логами сервера')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s =>
            s.setName('enable').setDescription('Включить логирование')
        )
        .addSubcommand(s =>
            s.setName('disable').setDescription('Выключить логирование')
        )
        .addSubcommand(s =>
            s.setName('channel')
                .setDescription('Установить канал для логов')
                .addChannelOption(o =>
                    o.setName('channel')
                        .setDescription('Канал для логов')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName('show').setDescription('Показать текущие настройки логов')
        )
        .addSubcommand(s =>
            s.setName('settings').setDescription('Открыть панель с категориями логов')
        ),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const embed = createAlertEmbed('error', user, t.modNoPerms);
            return interaction.editReply({ embeds: [embed] });
        }

        const buildChannelBlock = async () => {
            const cfg = await log.getLoggingSettings(interaction.guildId);
            const ch = cfg.channelId
                ? interaction.guild.channels.cache.get(cfg.channelId)
                : null;
            return ch
                ? `\`\`\`\nchannel: ${ch.name}\nid: ${ch.id}\n\`\`\``
                : `\`\`\`\nchannel: —\nid: —\n\`\`\``;
        };

        // ─── enable ───
        if (sub === 'enable') {
            await log.setLoggingEnabled(interaction.guildId, true);
            const block = await buildChannelBlock();
            const embed = createAlertEmbed('success', user, `${t.logNowEnabled}\n${block}`, {
                action: t.alertActionLogging,
            });
            return interaction.editReply({ embeds: [embed] });
        }

        // ─── disable ───
        if (sub === 'disable') {
            await log.setLoggingEnabled(interaction.guildId, false);
            const block = await buildChannelBlock();
            const embed = createAlertEmbed('success', user, `${t.logNowDisabled}\n${block}`, {
                action: t.alertActionLogging,
            });
            return interaction.editReply({ embeds: [embed] });
        }

        // ─── channel ───
        if (sub === 'channel') {
            const channel = interaction.options.getChannel('channel');
            await log.setLoggingChannel(interaction.guildId, channel.id);
            const block = await buildChannelBlock();
            const embed = createAlertEmbed('success', user, `${t.logChannelSet(channel.toString())}\n${block}`, {
                action: t.alertActionLogging,
            });
            return interaction.editReply({ embeds: [embed] });
        }

        // ─── show ───
        if (sub === 'show') {
            const cfg = await log.getLoggingSettings(interaction.guildId);
            const ch = cfg.channelId
                ? interaction.guild.channels.cache.get(cfg.channelId)
                : null;

            const rules = log.CATEGORIES
                .filter(c => log.isCategoryEnabled(cfg.events, c))
                .map(c => t[`logCat_${c}`] ?? c)
                .join(', ');

            return interaction.editReply({
                content: '```\n' +
                    `channel: ${ch ? ch.name : '—'}\n` +
                    `id: ${ch ? ch.id : '—'}\n\n` +
                    `status: ${cfg.enabled ? 'enabled' : 'disabled'}\n` +
                    `rules: ${rules || '—'}\n` +
                    '```',
            });
        }

        // ─── settings ───
        if (sub === 'settings') {
            const container = await buildLoggingPanel(interaction.guildId, t);
            return interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    },

    components: {
        logging_toggle: handleToggle,
        logging_cat: handleCategory,
    },
};