// Текстовая команда только для владельца (проверка в handlers/events.js).
// Использование:
//   !addmoney <user> <amount> [currency]
//   !addmoney @user 500 USD
//   !addmoney 1126101054421991548 1000 RUB

const { EmbedBuilder } = require('discord.js');
const eco = require('../utils/economy');

module.exports = {
    name: 'addmoney',
    aliases: ['am', 'grant'],

    execute: async (client, message, args) => {
        if (args.length < 2) {
            return message.reply({
                content: [
                    '**Использование:** `addmoney <user|id> <amount> [currency=USD]`',
                    '**Примеры:**',
                    '`addmoney @user 500`',
                    '`addmoney 1126101054421991548 1000 RUB`',
                ].join('\n'),
            }).catch(() => {});
        }

        // ── кому ──
        const targetRaw = args[0];
        const mention = message.mentions.users.first();
        const userId = mention?.id ?? targetRaw.replace(/[^\d]/g, '');

        if (!/^\d{17,20}$/.test(userId)) {
            return message.reply({ content: 'укажи корректного пользователя (mention или ID).' }).catch(() => {});
        }

        // ── сколько ──
        const amount = parseFloat(args[1].replace(',', '.'));
        if (!Number.isFinite(amount) || amount === 0) {
            return message.reply({ content: 'укажи корректную сумму (число).' }).catch(() => {});
        }

        // ── валюта ──
        const currency = (args[2] ?? 'USD').toUpperCase();

        // проверим, что валюта существует
        const rate = await eco.getRate(currency, message.guildId);
        if (rate == null) {
            return message.reply({
                content: `валюта \`${currency}\` не найдена. Доступные: USD, EUR, JPY, GBP, CNY, CHF, RUB, CAD, + серверная.`,
            }).catch(() => {});
        }

        // ── начисляем ──
        const taxRate = 0; // админский ввод — без налога
        const token = await eco.createTransaction({
            userId,
            guildId: message.guildId,
            type: 'admin_grant',
            currency,
            amount,
            taxRate,
            meta: {
                by: message.author.id,
                byTag: message.author.tag,
            },
        });

        const newBalance = await eco.addBalance(userId, message.guildId, currency, amount);

        const embed = new EmbedBuilder()
            .setTitle('💰 Admin grant')
            .setDescription([
                `**Получатель:** <@${userId}> (\`${userId}\`)`,
                `**Сумма:** ${eco.formatMoney(amount, currency)}`,
                `**Новый баланс:** ${eco.formatMoney(newBalance, currency)}`,
                `**Курс:** 1 ${currency} = ${eco.formatRate(rate)} USD`,
                '',
                `**Токен:** \`${token}\``,
            ].join('\n'))
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    },
};