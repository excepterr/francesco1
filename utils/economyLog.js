const { EmbedBuilder } = require('discord.js');
const { sendLogEvent } = require('./logging');

/**
 * Отправляет транзакцию в канал логов.
 * @param {object} client
 * @param {object} tx
 */
async function logTransaction(client, tx) {
    const { token, userId, guildId, type, currency, amount, taxAmount, netAmount, amountUSD, meta } = tx;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const embed = new EmbedBuilder()
        .setTitle('💸 Транзакция')
        .setColor(null)
        .addFields(
            { name: 'Тип', value: `\`${type}\``, inline: true },
            { name: 'Юзер', value: `<@${userId}>\n\`${userId}\``, inline: true },
            { name: 'Валюта', value: `\`${currency}\``, inline: true },
            { name: 'Сумма', value: `\`${amount}\``, inline: true },
            { name: 'Налог', value: `\`${taxAmount ?? 0}\``, inline: true },
            { name: 'Нетто', value: `\`${netAmount ?? amount}\``, inline: true },
            { name: 'В USD', value: `\`${amountUSD ?? '—'}\``, inline: true },
            { name: 'Токен', value: `\`${token}\`` },
        )
        .setTimestamp();

    if (meta && Object.keys(meta).length) {
        const metaStr = Object.entries(meta)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join('\n')
            .slice(0, 1000);
        embed.addFields({ name: 'Meta', value: '```\n' + metaStr + '\n```' });
    }

    await sendLogEvent(client, guild, 'economy_tx', { embeds: [embed] });
}

module.exports = { logTransaction };