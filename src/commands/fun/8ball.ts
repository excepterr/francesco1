import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8-ball.')
        .setDescriptionLocalizations(getLocalizations('commands.8ball.description'))
        .addStringOption((opt) =>
            opt.setName('question')
                .setDescription('Your question.')
                .setDescriptionLocalizations(getLocalizations('commands.8ball.questionOption'))
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const question = interaction.options.getString('question', true);
        
        const answers = t(lang, 'commands.8ball.answers', { returnObjects: true }) as string[];
        const answer = answers[Math.floor(Math.random() * answers.length)];

        await interaction.reply({
            content: `🎱 **${t(lang, 'commands.8ball.question')}:** ${question}\n**${t(lang, 'commands.8ball.answer')}:** ${answer}`
        });
    },
};