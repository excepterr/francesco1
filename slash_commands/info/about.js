const {
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    SeparatorSpacingSize, MessageFlags,
} = require('discord.js');
const os = require('os');
const { getSettings } = require('../../utils/settings');
const config = require('../../config.json');

const INVITE_URL = 'https://discord.gg/P25v2r76Zc';
const SUPPORT_URL = 'https://discord.gg/P25v2r76Zc';

const BAR_SIZE = 10;
const FILLED = '▰';
const EMPTY = '▱';

function bar(percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * BAR_SIZE);
    return FILLED.repeat(filled) + EMPTY.repeat(BAR_SIZE - filled);
}

function getCpuPercent() {
    const usage = process.cpuUsage();
    const totalMicro = usage.user + usage.system;
    const uptimeMicro = process.uptime() * 1e6;
    if (uptimeMicro <= 0) return 0;
    return Math.min(100, (totalMicro / uptimeMicro) * 100);
}

function getSections(t) {
    return {
        main:  { id: 'main',  label: t.aboutTabMain  ?? 'Основное' },
        tech:  { id: 'tech',  label: t.aboutTabTech  ?? 'Техническая информация' },
        load:  { id: 'load',  label: t.aboutTabLoad  ?? 'Нагрузка' },
        other: { id: 'other', label: t.aboutTabOther ?? 'Другое' },
    };
}

async function buildContent(client, section) {
    if (section === 'main') {
        const guilds = client.guilds.cache.size;
        const users = client.guilds.cache.reduce((a, g) => a + (g.memberCount ?? 0), 0);
        const owner = await client.users.fetch(config.ownerId).catch(() => null);
        const ownerName = owner?.username ?? 'unknown';

        return '```\n' + [
            `Серверов:       ${guilds}`,
            `Пользователей:  ${users}`,
            `Версия Node.js: ${process.version}`,
            `Автор:          ${ownerName}`,
        ].join('\n') + '\n```';
    }

    if (section === 'tech') {
        const up = Math.floor(process.uptime());
        const d = Math.floor(up / 86400);
        const h = Math.floor((up % 86400) / 3600);
        const m = Math.floor((up % 3600) / 60);

        return '```\n' + [
            `Шардов: ${client.ws.shards.size}`,
            `Пинг:   ${client.ws.ping}ms`,
            `Аптайм: ${d}d ${h}h ${m}m`,
        ].join('\n') + '\n```';
    }

    if (section === 'load') {
        const cpu = getCpuPercent();

        const usedBytes = os.totalmem() - os.freemem();
        const totalBytes = os.totalmem();
        const usedGB = usedBytes / 1024 ** 3;
        const totalGB = totalBytes / 1024 ** 3;
        const memPct = totalGB > 0 ? (usedGB / totalGB) * 100 : 0;

        return [
            'Процессор:',
            '```',
            `${bar(cpu)} ${cpu.toFixed(1)}%`,
            '```',
            'ОЗУ:',
            '```',
            `${bar(memPct)} ${usedGB.toFixed(1)}/${totalGB.toFixed(1)} GB`,
            '```',
        ].join('\n');
    }

    const mem = process.memoryUsage();
    return '```\n' + [
        `Платформа: ${process.platform} ${process.arch}`,
        `Память:    ${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
        `Пинг:      ${client.ws.ping}ms`,
    ].join('\n') + '\n```';
}

function buildTabsRow(t, active, userId) {
    const sections = getSections(t);
    const row = new ActionRowBuilder();
    for (const key of ['main', 'tech', 'load', 'other']) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`about_${key}:${userId}`)
                .setLabel(sections[key].label)
                .setStyle(key === active ? ButtonStyle.Primary : ButtonStyle.Secondary),
        );
    }
    return row;
}

function buildLinksRow(t) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(t.aboutSupport ?? 'Сервер поддержки')
            .setStyle(ButtonStyle.Link)
            .setURL(SUPPORT_URL),
        new ButtonBuilder()
            .setLabel(t.aboutInvite ?? 'Пригласить')
            .setStyle(ButtonStyle.Link)
            .setURL(INVITE_URL),
    );
}

async function buildContainer(client, section, t, userId) {
    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${client.user.username}`),
    );

    container.addActionRowComponents(buildTabsRow(t, section, userId));

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const content = await buildContent(client, section);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(content),
    );

    const ts = Math.floor(Date.now() / 1000);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`),
    );

    return container;
}

async function handleTab(client, interaction) {
    const section = interaction.customId.split(':')[0].replace('about_', '');
    const { lang } = await getSettings(interaction.guildId);
    const t = client.locales[lang] ?? client.locales.ru;

    const container = await buildContainer(client, section, t, interaction.user.id);
    const links = buildLinksRow(t);

    return interaction.update({
        components: [container, links],
        flags: MessageFlags.IsComponentsV2,
    });
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Информация о боте'),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;

        const container = await buildContainer(client, 'main', t, interaction.user.id);
        const links = buildLinksRow(t);

        return interaction.reply({
            components: [container, links],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [], repliedUser: false },
        });
    },

    components: {
        about_main:  handleTab,
        about_tech:  handleTab,
        about_load:  handleTab,
        about_other: handleTab,
    },
};