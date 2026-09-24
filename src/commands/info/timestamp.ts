import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    data: new SlashCommandBuilder()
        .setName('timestamp')
        .setDescription('Generate Discord timestamps.')
        .setDescriptionLocalizations(getLocalizations('commands.timestamp.description'))
        .addStringOption((opt) =>
            opt
                .setName('time')
                .setDescription('Time (e.g. "now", "5m", "2026-01-01 12:00", "12:00")')
                .setRequired(false)
                .setDescriptionLocalizations(
                    getLocalizations('commands.timestamp.option'),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const input = interaction.options.getString('time') ?? 'now';

        let ts = Math.floor(Date.now() / 1000);

        if (input !== 'now') {
            const parsed = parseTime(input);
            if (parsed) ts = parsed;
        }

        const formats: Array<[string, string]> = [
            ['t', t(lang, 'timestamp.shortTime')],
            ['T', t(lang, 'timestamp.longTime')],
            ['d', t(lang, 'timestamp.shortDate')],
            ['D', t(lang, 'timestamp.longDate')],
            ['f', t(lang, 'timestamp.shortDateTime')],
            ['F', t(lang, 'timestamp.longDateTime')],
            ['R', t(lang, 'timestamp.relative')],
        ];

        const lines = formats.map(
            ([fmt, label]) => `\`<t:${ts}:${fmt}>\` — **${label}**: <t:${ts}:${fmt}>`,
        );

        const embed = new EmbedBuilder()
            .setDescription(`### ${t(lang, 'timestamp.title')}\n\n${lines.join('\n')}`);

        await interaction.editReply({ embeds: [embed] });
    },
};

function parseTime(input: string): number | null {
    const now = Date.now();

    // "5m", "2h", "3d"
    const rel = input.match(/^(\d+)\s*(s|m|h|d)$/i);
    if (rel) {
        const n = parseInt(rel[1]);
        const unit = rel[2].toLowerCase();
        const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
        return Math.floor((now + n * ms) / 1000);
    }

    // ISO / Date.parse
    const d = new Date(input);
    if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);

    return null;
}