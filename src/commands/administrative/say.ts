import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';

export default {
    ephemeral: true, // авто-defer будет ephemeral — «Отправлено!» увидит только автор

    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send a message as the bot.')
        .setDescriptionLocalizations(getLocalizations('commands.say.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((opt) =>
            opt
                .setName('message')
                .setDescription('Message content.')
                .setRequired(true)
                .setDescriptionLocalizations(getLocalizations('commands.say.option')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const text = interaction.options.getString('message', true);
        const channel = interaction.channel;

        // Проверка канала — уметь отправлять сообщения
        if (!channel || !channel.isTextBased() || !('send' in channel)) {
            throw new UserError(t(lang, 'errors.notFound'));
        }

        // 1. Отправляем сообщение от имени бота в текущий канал
        await (channel as TextChannel).send({
            content: text,
            allowedMentions: { parse: [] }, // чтобы юзер не пинговал всех через say
        });

        // 2. Ephemeral-ответ автору
        await interaction.editReply({
            content: t(lang, 'say.sent'),
        });
    },
};