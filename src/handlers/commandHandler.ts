import path from 'path';
import { MyClient } from '../client';
import { getAllFiles } from '../lib/fileWalker';

export function loadCommands(client: MyClient) {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = getAllFiles(commandsPath);

    for (const filePath of commandFiles) {
        const imported = require(filePath);
        const command = imported.default ?? imported;

        if ('data' in command && 'execute' in command) {
            const relPath = path.relative(commandsPath, filePath);
            const moduleName = relPath.split(path.sep)[0];

            command.module = moduleName;
            command.localizationKey = command.localizationKey ?? command.data.name;

            client.commands.set(command.data.name, command);
            console.log(`[COMMAND] ${command.data.name} (${moduleName})`);
        } else {
            console.log(`[WARNING] ${filePath}: нет "data" или "execute"`);
        }
    }
}