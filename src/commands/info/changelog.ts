import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

interface ChangelogData {
    version: string;
    changes: string[];
}

function loadChangelog(): ChangelogData {
    const filePath = path.join(process.cwd(), 'changelog.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ChangelogData;
}

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('Shows the bot changelog.')
        .setDescriptionLocalizations(getLocalizations('commands.changelog.description')),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);

        let data: ChangelogData;
        try {
            data = loadChangelog();
        } catch (err) {
            console.error('[changelog] Failed to load changelog.json:', err);
            await interaction.reply({
                content: t(lang, 'errors.generic'),
                ephemeral: true,
            });
            return;
        }

        const changesList = data.changes.map((c) => `• ${c}`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(t(lang, 'changelog.title', { user: interaction.user.username }))
            .setDescription(
                `${t(lang, 'changelog.version')}: \`${data.version}\`\n` +
                '```\n' + changesList + '\n```',
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};