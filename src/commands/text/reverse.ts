import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('reverse')
        .setDescription('Reverse text.')
        .setDescriptionLocalizations(getLocalizations('commands.reverse.description'))
        .addStringOption((opt) =>
            opt.setName('text')
                .setDescription('Text to reverse.')
                .setDescriptionLocalizations(getLocalizations('commands.reverse.textOption'))
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const text = interaction.options.getString('text', true);
        const result = text.split('').reverse().join('');
        await interaction.reply(t(lang, 'commands.reverse.result', { result }));
    },
};