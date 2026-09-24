import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a dice.')
        .setDescriptionLocalizations(getLocalizations('commands.dice.description'))
        .addIntegerOption((opt) =>
            opt.setName('sides')
                .setDescription('Number of sides (default 6).')
                .setDescriptionLocalizations(getLocalizations('commands.dice.sidesOption'))
                .setMinValue(2)
                .setMaxValue(100)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const sides = interaction.options.getInteger('sides') ?? 6;
        const result = Math.floor(Math.random() * sides) + 1;

        await interaction.reply(t(lang, 'commands.dice.result', { result }));
    },
};