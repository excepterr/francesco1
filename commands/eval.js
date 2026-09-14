// Техническая команда, доступна только владельцу (проверка в handlers/events.js).
const { inspect } = require('util');

module.exports = {
    name: 'eval',
    aliases: ['e'],
    execute: async (client, message, args) => {
        const code = args.join(' ');
        if (!code) return message.reply('укажи код для выполнения.').catch(() => {});

        try {
            let result = eval(code);
            if (result instanceof Promise) result = await result;

            const output = inspect(result, { depth: 1 }).slice(0, 1900);
            await message.reply(`\`\`\`js\n${output}\n\`\`\``);
        } catch (error) {
            await message.reply(`\`\`\`js\nОшибка: ${error.message}\n\`\`\``).catch(() => {});
        }
    },
};
