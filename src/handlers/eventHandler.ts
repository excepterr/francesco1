import path from 'path';
import { MyClient } from '../client';
import { getAllFiles } from '../lib/fileWalker';

export function loadEvents(client: MyClient) {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = getAllFiles(eventsPath);

    for (const filePath of eventFiles) {
        const imported = require(filePath);
        const raw = imported.default ?? imported;

        // Поддержка массива событий из одного файла
        const events = Array.isArray(raw) ? raw : [raw];

        for (const event of events) {
            if (!event?.name || !event?.execute) {
                console.log(`[WARNING] ${filePath}: нет "name" или "execute"`);
                continue;
            }

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
            console.log(`[EVENT] Загружено событие: ${event.name}`);
        }
    }
}