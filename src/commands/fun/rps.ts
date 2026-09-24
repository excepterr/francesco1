import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Rock, Paper, Scissors.')
        .setDescriptionLocalizations(getLocalizations('commands.rps.description'))
        .addStringOption((opt) =>
            opt.setName('choice')
                .setDescription('Your choice.')
                .setDescriptionLocalizations(getLocalizations('commands.rps.choiceOption'))
                .setRequired(true)
                .addChoices(
                    { name: 'Rock', value: 'rock' },
                    { name: 'Paper', value: 'paper' },
                    { name: 'Scissors', value: 'scissors' }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const userChoice = interaction.options.getString('choice', true);
        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];

        const botLabel = t(lang, `commands.rps.${botChoice}`);

        let resultKey = '';
        if (userChoice === botChoice) {
            resultKey = 'commands.rps.draw';
        } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            resultKey = 'commands.rps.win';
        } else {
            resultKey = 'commands.rps.lose';
        }

        await interaction.reply(t(lang, resultKey, { bot: botLabel }));
    },
};