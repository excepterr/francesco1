const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const prefixPath = path.join(__dirname, '../commands');

    if (!fs.existsSync(prefixPath)) return;

    // Все текстовые команды лежат плоско в ./commands, без категорий.
    // Они не регистрируются в Discord и не попадают в /help —
    // это технические команды только для владельца (проверка в events.js).
    for (const file of fs.readdirSync(prefixPath).filter(f => f.endsWith('.js'))) {
        const command = require(path.join(prefixPath, file));

        if (command.name && command.execute) {
            client.prefixCommands.set(command.name, command);

            for (const alias of command.aliases ?? []) {
                client.prefixCommands.set(alias, command);
            }
        }
    }

    console.log(`Загружено ${client.prefixCommands.size} текстовых команд (включая алиасы).`);
};
