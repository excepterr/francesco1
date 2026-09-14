const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const FORMATS = ['t', 'T', 'd', 'D', 'f', 'F', 'R'];
const FORMAT_KEYS = {
    t: 'tsShortTime', T: 'tsLongTime', d: 'tsShortDate', D: 'tsLongDate',
    f: 'tsShortFull', F: 'tsLongFull', R: 'tsRelative',
};

function parseInput(raw) {
    const s = String(raw).trim();
    const rel = s.match(/^([+-])\s*(\d+)\s*(s|m|h|d|w)$/i);
    if (rel) {
        const sign = rel[1] === '-' ? -1 : 1;
        const ms = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 }[rel[3].toLowerCase()];
        return new Date(Date.now() + sign * parseInt(rel[2], 10) * ms);
    }
    if (/^\d+$/.test(s)) {
        const n = Number(s);
        const date = new Date(s.length >= 12 ? n : n * 1000);
        if (!Number.isNaN(date.getTime())) return date;
    }
    const p = new Date(s);
    if (!Number.isNaN(p.getTime())) return p;
    return null;
}

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('timestamp')
        .setDescription('Генератор Discord-таймстемпов')
        .addStringOption(o => o.setName('time')
            .setDescription('Unix, ISO, дата или +1h / +30m / +2d').setRequired(true)),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        const raw = interaction.options.getString('time');
        const date = parseInput(raw);
        if (!date) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.tsInvalid)] });
        }

        const unix = Math.floor(date.getTime() / 1000);
        const lines = FORMATS.map(f => {
            const label = t[FORMAT_KEYS[f]] ?? f;
            return `\`<t:${unix}:${f}>\` — **${label}**: <t:${unix}:${f}>`;
        });

        const embed = new EmbedBuilder()
            .setTitle(t.tsTitle)
            .setDescription(lines.join('\n'))
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};