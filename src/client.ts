import { Client, Collection, GatewayIntentBits } from 'discord.js';

// Создаем свой класс, наследуясь от стандартного Client
export class MyClient extends Client {
    // Добавляем свойство для хранения команд
    public commands: Collection<string, any> = new Collection();
    public regenData: Collection<string, any> = new Collection(); // 👈 новое

    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildVoiceStates,   // ← должно быть
            ],
        });
    }
}