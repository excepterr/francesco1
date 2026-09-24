import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('uppercase')
        .setDescription('Convert text to uppercase.')
        .setDescriptionLocalizations(getLocalizations('commands.uppercase.description'))
        .addStringOption((opt) =>
            opt.setName('text')
                .setDescription('Text.')
                .setDescriptionLocalizations(getLocalizations('commands.uppercase.textOption'))
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const text = interaction.options.getString('text', true);
        await interaction.reply(t(lang, 'commands.uppercase.result', { result: text.toUpperCase() }));
    },
};