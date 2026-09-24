import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin.')
        .setDescriptionLocalizations(getLocalizations('commands.coinflip.description')),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const isHeads = Math.random() < 0.5;
        const resultKey = isHeads ? 'commands.coinflip.heads' : 'commands.coinflip.tails';
        
        await interaction.reply(t(lang, resultKey));
    },
};