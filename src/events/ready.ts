import { MyClient } from '../client';
import { pingHistory } from '../lib/pingHistory';
import { startBirthdayScheduler } from '../lib/birthdayScheduler';
import { initMusic } from '../lib/music';   // ← новое

export default {
    name: 'clientReady',
    once: true,
    execute(client: MyClient) {
        console.log(`Бот ${client.user?.tag} готов к работе!`);
        pingHistory.start(client);
        startBirthdayScheduler(client);
    },
};