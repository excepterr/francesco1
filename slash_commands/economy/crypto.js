const {
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const eco = require('../../utils/economy');

function buildContainer(content, title) {
    const c = new ContainerBuilder().setAccentColor(null);
    if (title) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    }
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`));
    return c;
}

module.exports = {
    cooldown: 3,
    ephemeral: false,

    data: new SlashCommandBuilder()
        .setName('crypto')
        .setDescription('Криптовалюты')
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Список всех криптовалют с курсами и динамикой'))
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('[OWNER] Добавить новую криптовалюту')
            .addStringOption(o => o.setName('code').setDescription('Тикер (BTC, ETH, ...)').setRequired(true).setMinLength(2).setMaxLength(6))
            .addStringOption(o => o.setName('name').setDescription('Название (Bitcoin)').setRequired(true))
            .addNumberOption(o => o.setName('usd_rate').setDescription('Курс в USD (например 67000)').setRequired(true).setMinValue(0.000001))
            .addStringOption(o => o.setName('symbol').setDescription('Символ (₿, Ξ, ...)').setRequired(false))
            .addStringOption(o => o.setName('emoji').setDescription('Эмодзи (🟠, 🔷, ...)').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('[OWNER] Удалить криптовалюту')
            .addStringOption(o => o.setName('code').setDescription('Тикер для удаления').setRequired(true))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        // ═══════ LIST ═══════
        if (sub === 'list') {
            const preferred = await eco.getPreferredCurrency(user.id, interaction.guildId);
            const cryptos = await eco.getCryptoCurrencies();

            if (cryptos.length === 0) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('warning', user, t.cryptoEmpty)],
                });
            }

            const lines = [];
            for (const c of cryptos) {
                // цена 1 единицы в валюте показа юзера
                const inDisplay = await eco.convert(1, c.code, preferred, interaction.guildId);
                const priceStr = inDisplay == null
                    ? '—'
                    : `${inDisplay.toLocaleString('ru-RU', { maximumFractionDigits: 6 })} ${preferred}`;

                const change = await eco.getCryptoChange24h(c.code);
                const changeStr = change == null
                    ? ''
                    : ` (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`;

                const mark = c.code === preferred ? '▸' : ' ';
                const emoji = c.emoji ? `${c.emoji} ` : '';

                lines.push(`${mark} ${emoji}**${c.code}** — ${c.name}`);
                lines.push(`    ${priceStr}${changeStr}`);
            }

            const container = buildContainer(
                lines.join('\n'),
                `${t.cryptoListTitle} (${cryptos.length})`,
            );
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ ADD ═══════
        if (sub === 'add') {
            // только владелец бота
            const config = require('../../config.json');
            if (user.id !== config.ownerId) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
            }

            const code = interaction.options.getString('code').toUpperCase().trim();
            const name = interaction.options.getString('name').trim();
            const usdRate = interaction.options.getNumber('usd_rate');
            const symbol = interaction.options.getString('symbol')?.trim() ?? null;
            const emoji = interaction.options.getString('emoji')?.trim() ?? null;

            if (!/^[A-Z0-9]{2,6}$/.test(code)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.cryptoInvalidCode)] });
            }

            const result = await eco.addCrypto({
                code, name, symbol, emoji,
                rateUsd: usdRate,
                createdBy: user.id,
            });

            if (!result.ok) {
                const map = {
                    exists: t.cryptoExists,
                    reserved: t.cryptoReserved,
                    db_error: t.errorOccurred,
                };
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, map[result.reason] ?? t.errorOccurred)],
                });
            }

            const lines = [
                `**Code:** \`${code}\``,
                `**Name:** ${name}`,
                symbol ? `**Symbol:** ${symbol}` : '',
                emoji ? `**Emoji:** ${emoji}` : '',
                `**Rate:** 1 ${code} = ${eco.formatRate(usdRate)} USD`,
            ].filter(Boolean).join('\n');

            const container = buildContainer(lines, t.cryptoCreated);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ REMOVE ═══════
        if (sub === 'remove') {
            const config = require('../../config.json');
            if (user.id !== config.ownerId) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
            }

            const code = interaction.options.getString('code').toUpperCase().trim();

            const exists = await eco.getCryptoByCode(code);
            if (!exists) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.cryptoNotFound)] });
            }

            const result = await eco.removeCrypto(code);
            if (!result.ok) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.errorOccurred)] });
            }

            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.cryptoRemoved(code))],
            });
        }
    },
};