const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { Manager } = require('moonlink.js');
const config = require('./config.json');
const economy = require('./utils/economy');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates, // <-- ОБЯЗАТЕЛЬНО для музыки
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
});

// === Настройка Moonlink Manager ===
client.moon = new Manager(
    {
        nodes: [
            {
                host: 'localhost',
                port: 3000,                          // ← было 2333
                password: 'youshallnotpass',         // ← сверь с config.ts
                secure: false,
                identifier: 'main',
            },
        ],
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
    },
    {
        // Опции по умолчанию для плееров
        defaultPlayer: {
            autoPlay: false,
            autoLeave: true,
            volume: 100,
        },
    }
);

// Инициализация при готовности
client.once('clientReady', () => {
    console.log(`Вошёл как ${client.user.tag}`);

    // флуктуация курсов каждые 5 минут
    setInterval(() => {
        economy.fluctuateRates().catch(err => console.error('[economy] fluctuate:', err));
    }, 5 * 60_000).unref();

    // первый прогон сразу
    economy.fluctuateRates().catch(() => {});
});

// Пересылка голосовых пакетов из Discord в Moonlink
client.on('raw', (data) => {
    client.moon.packetUpdate(data);
});

// === Загрузка хендлеров и команд ===
client.locales = {
    ru: require('./locales/ru'),
    en: require('./locales/en'),
    ja: require('./locales/ja'),
};

client.slashCommands = new Collection();
client.prefixCommands = new Collection();
client.components = new Collection();
client.sessions = new Map();
client.regenData = new Map();
client.shopPages = new Map();

require('./handlers/slash')(client);
require('./handlers/prefix')(client);
require('./handlers/events')(client);

client.login(config.token);