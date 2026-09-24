import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    EmbedBuilder,
} from 'discord.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { MyClient } from '../../client';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { pingHistory } from '../../lib/pingHistory';
import { generatePingChart } from '../../lib/pingChart';

const SUPPORT_URL = 'https://discord.gg/P25v2r76Zc';
const INVITE_URL  = 'https://discord.com/oauth2/authorize?client_id=1547565410524725279&permissions=2253313138878710&integration_type=0&scope=bot+applications.commands';

const DEVELOPER_ID = '1126101054421991548';

function formatUptime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

function getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
        const snapshot = () => os.cpus().map((c) => ({ ...c.times }));
        const start = snapshot();
        setTimeout(() => {
            const end = snapshot();
            let idleDiff = 0;
            let totalDiff = 0;
            for (let i = 0; i < start.length; i++) {
                const s = start[i];
                const e = end[i];
                idleDiff += e.idle - s.idle;
                totalDiff +=
                    e.user + e.nice + e.sys + e.idle + e.irq -
                    (s.user + s.nice + s.sys + s.idle + s.irq);
            }
            resolve(totalDiff === 0 ? 0 : (1 - idleDiff / totalDiff) * 100);
        }, 200);
    });
}

let cachedVersion: string | null = null;
function getBuildVersion(): string {
    if (cachedVersion) return cachedVersion;
    try {
        const p = path.join(__dirname, '..', '..', '..', 'changelog.json');
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        cachedVersion = data.version ?? 'unknown';
    } catch {
        cachedVersion =
            process.env.BUILD_HASH ??
            `prod_1.0.0_${process.version.replace('v', '')}`;
    }
    return cachedVersion!;
}

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Shows information about the bot.')
        .setDescriptionLocalizations(getLocalizations('commands.about.description')),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const client = interaction.client as MyClient;
        const lang = getUserLanguage(interaction);

        // --- Метрики ---
        const cpuUsage = await getCpuUsage();
        const totalMem = os.totalmem();
        const usedMem = totalMem - os.freemem();
        const ramPercent = (usedMem / totalMem) * 100;

        const wsLatency = Math.round(client.ws.ping);
        const roundtripLatency = Date.now() - interaction.createdTimestamp;
        const uptimeMs = client.uptime ?? 0;
        const startedTimestamp = Math.floor((Date.now() - uptimeMs) / 1000);

        const buildVersion = getBuildVersion();

        // --- Лейблы для канваса ---
        const labels = {
            title: t(lang, 'about.chartTitle'),
            badge: t(lang, 'about.chartBadge'),
            allRegions: t(lang, 'about.chartAllRegions'),
            day: t(lang, 'about.chartDay'),
            week: t(lang, 'about.chartWeek'),
            month: t(lang, 'about.chartMonth'),
            average: t(lang, 'about.chartAverage'),
            uptime: t(lang, 'about.chartUptime'),
            ramLoad: t(lang, 'about.chartRamLoad'),
            cpuLoad: t(lang, 'about.chartCpuLoad'),
            ms: t(lang, 'about.chartMs'),
        };

        // --- PNG (отдельным файлом) ---
        const history = pingHistory.get();
        const buffer = generatePingChart(
            history,
            {
                avg: pingHistory.getAvg(),
                uptime: formatUptime(uptimeMs),
                ramUsage: ramPercent,
                cpuUsage,
            },
            labels,
        );

        const attachment = new AttachmentBuilder(buffer, { name: 'about.png' });

        // --- Dev-строка: .excepterr (id - @mention) ---
        const devString = `.excepterr (${DEVELOPER_ID} - <@${DEVELOPER_ID}>)`;

        // --- Эмбед ---
        const embed = new EmbedBuilder()
            .setTitle(t(lang, 'about.title', { botName: client.user?.username ?? 'Bot' }))
            .setDescription(t(lang, 'about.botDesc', { dev: devString }))
            .setThumbnail(client.user?.displayAvatarURL({ extension: 'png', size: 256 }) ?? null)
            .addFields(
                {
                    name: t(lang, 'about.apiLatency'),
                    value: `${wsLatency} ${t(lang, 'about.ms')}`,
                    inline: false,
                },
                {
                    name: t(lang, 'about.messageLatency'),
                    value: `${roundtripLatency} ${t(lang, 'about.ms')}`,
                    inline: false,
                },
                {
                    name: t(lang, 'about.started'),
                    value: `<t:${startedTimestamp}:R>`,
                    inline: true,
                },
                {
                    name: t(lang, 'about.buildHash'),
                    value: `\`${buildVersion}\``,
                    inline: true,
                },
            );

        // --- Кнопки-ссылки ---
        const links = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel(t(lang, 'about.supportButton'))
                .setURL(SUPPORT_URL)
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel(t(lang, 'about.inviteButton'))
                .setURL(INVITE_URL)
                .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({
            embeds: [embed],
            components: [links],
            files: [attachment],
        });
    },
};