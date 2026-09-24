import { Message } from 'discord.js';
import { MyClient } from '../client';
import { handleAiMention } from '../lib/aiMention';

export default {
    name: 'messageCreate',
    once: false,
    async execute(message: Message) {
        if (message.author.bot) return;
        if (!message.guildId) return;
        if (!message.content) return;

        const client = message.client as MyClient;
        if (!client.user) return;

        // Проверяем, пингуют ли бота
        if (!message.mentions.has(client.user)) return;

        await handleAiMention(client, message).catch((e) =>
            console.error('[AI] Ошибка в handleAiMention:', e),
        );
    },
};