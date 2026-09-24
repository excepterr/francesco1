import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('lowercase')
        .setDescription('Convert text to lowercase.')
        .setDescriptionLocalizations(getLocalizations('commands.lowercase.description'))
        .addStringOption((opt) =>
            opt.setName('text')
                .setDescription('Text.')
                .setDescriptionLocalizations(getLocalizations('commands.lowercase.textOption'))
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const text = interaction.options.getString('text', true);
        await interaction.reply(t(lang, 'commands.lowercase.result', { result: text.toLowerCase() }));
    },
};