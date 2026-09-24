import 'dotenv/config';
import { MyClient } from './client';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { deployCommands } from './handlers/deployHandler';
import { initI18n } from './lib/i18n';
import { initMusic } from './lib/music'; // 👈 импорт

const client = new MyClient();

async function main() {
    await initI18n();

    loadCommands(client);
    loadEvents(client);

    await deployCommands();

    // 👇 Инициализация Shoukaku ДО login()
    initMusic(client);

    await client.login(process.env.TOKEN);
}

main();