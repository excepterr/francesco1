import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import { getAllFiles } from '../lib/fileWalker';

export async function deployCommands() {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = getAllFiles(commandsPath);

    for (const filePath of commandFiles) {
        const imported = require(filePath);
        const command = imported.default ?? imported;
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        }
    }

    const clientId = process.env.CLIENT_ID;
    if (!clientId) throw new Error('В .env не задан CLIENT_ID!');

    const rest = new REST().setToken(process.env.TOKEN!);

    try {
        console.log(`[DEPLOY] Регистрирую ${commands.length} глобальных команд...`);
        const data: any = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        // Сохраняем ID команд в файл
        const idsPath = path.join(__dirname, '..', '..', 'command-ids.json');
        const ids: Record<string, string> = {};
        for (const cmd of data) ids[cmd.name] = cmd.id;
        fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2));

        console.log(`[DEPLOY] ✅ Зарегистрировано ${data.length} команд, ID сохранены.`);
    } catch (error) {
        console.error('[DEPLOY] ❌ Ошибка:', error);
    }
}