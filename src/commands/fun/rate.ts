import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Rate something.')
        .setDescriptionLocalizations(getLocalizations('commands.rate.description'))
        .addStringOption((opt) =>
            opt.setName('thing')
                .setDescription('What to rate.')
                .setDescriptionLocalizations(getLocalizations('commands.rate.thingOption'))
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const thing = interaction.options.getString('thing', true);
        const rating = Math.floor(Math.random() * 11); // 0-10

        await interaction.reply(t(lang, 'commands.rate.result', { thing, rating }));
    },
};