import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('length')
        .setDescription('Count characters and words.')
        .setDescriptionLocalizations(getLocalizations('commands.length.description'))
        .addStringOption((opt) =>
            opt.setName('text')
                .setDescription('Text to analyze.')
                .setDescriptionLocalizations(getLocalizations('commands.length.textOption'))
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const text = interaction.options.getString('text', true);
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const charsNoSpaces = text.replace(/\s/g, '').length;

        const embed = new EmbedBuilder()
            .setTitle(t(lang, 'commands.length.title'))
            .addFields(
                { name: t(lang, 'commands.length.chars'), value: `${chars}`, inline: true },
                { name: t(lang, 'commands.length.words'), value: `${words}`, inline: true },
                { name: t(lang, 'commands.length.charsNoSpaces'), value: `${charsNoSpaces}`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },
};