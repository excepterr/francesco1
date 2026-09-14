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
        .setName('currency')
        .setDescription('Управление валютами')
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Показать все доступные валюты'))
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Выбрать валюту для отображения баланса')
            .addStringOption(o => o.setName('code').setDescription('Код валюты (USD, EUR, ...)').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('[ADMIN] Создать серверную валюту')
            .addStringOption(o => o.setName('code').setDescription('Код (3 буквы, напр. VLD)').setRequired(true).setMinLength(3).setMaxLength(5))
            .addStringOption(o => o.setName('name').setDescription('Название (напр. Владкоин)').setRequired(true))
            .addNumberOption(o => o.setName('usd_rate').setDescription('Курс: сколько USD стоит 1 единица (напр. 0.5)').setRequired(true).setMinValue(0.0001))
            .addStringOption(o => o.setName('symbol').setDescription('Символ (напр. Ⓥ)').setRequired(false))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        // ═══════ LIST ═══════
        if (sub === 'list') {
            const bases = await eco.getBaseCurrencies();
            const srv = await eco.getServerCurrency(interaction.guildId);
            const cryptos = await eco.getCryptoCurrencies();
            const preferred = await eco.getPreferredCurrency(user.id, interaction.guildId);

            const lines = [];

            // ── фиат ──
            lines.push(`**${t.currencyFiatSection}**`);
            const fiat = srv ? [...bases, srv] : [...bases];
            fiat.sort((a, b) => a.code.localeCompare(b.code));
            for (const c of fiat) {
                const mark = c.code === preferred ? '▸' : ' ';
                const sym = c.symbol ?? c.code;
                lines.push(`${mark} \`${c.code.padEnd(5)}\` ${sym.padEnd(4)} ${c.name} — 1 = ${eco.formatRate(c.rate_usd)} USD`);
            }

            // ── крипта ──
            if (cryptos.length) {
                lines.push('');
                lines.push(`**${t.currencyCryptoSection}**`);
                for (const c of cryptos) {
                    const mark = c.code === preferred ? '▸' : ' ';
                    const emoji = c.emoji ? c.emoji + ' ' : '';
                    lines.push(`${mark} \`${c.code.padEnd(5)}\` ${emoji}${c.name} — 1 = ${eco.formatRate(c.rate_usd)} USD`);
                }
            }

            lines.push('');
            lines.push(`*${t.currencyPreferred}: ${preferred}*`);

            const container = buildContainer(lines.join('\n'), t.currencyListTitle);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ SET ═══════
        if (sub === 'set') {
            const code = interaction.options.getString('code').toUpperCase().trim();

            const rate = await eco.getRate(code, interaction.guildId);
            if (rate == null) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.currencyUnknown)] });
            }

            await eco.setPreferredCurrency(user.id, interaction.guildId, code);

            const bal = await eco.getDisplayBalance(user.id, interaction.guildId, code);
            const line = `**${t.currencySetTo}:** \`${code}\`\n**${t.currencyYourBalance}:** ${eco.formatMoney(bal.amount, code)}`;

            const container = buildContainer(line, t.currencySetTitle);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ CREATE ═══════
        if (sub === 'create') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
            }

            const code = interaction.options.getString('code').toUpperCase().trim();
            const name = interaction.options.getString('name').trim();
            const symbol = interaction.options.getString('symbol')?.trim() ?? null;
            const usdRate = interaction.options.getNumber('usd_rate');

            if (!/^[A-Z0-9]{3,5}$/.test(code)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.currencyInvalidCode)] });
            }

            const result = await eco.createServerCurrency(interaction.guildId, code, name, symbol, usdRate);

            if (!result.ok) {
                const map = {
                    reserved: t.currencyReserved,
                    already_exists: t.currencyAlreadyExists,
                    db_error: t.errorOccurred,
                };
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, map[result.reason] ?? t.errorOccurred)] });
            }

            const lines = [
                `**Code:** \`${code}\``,
                `**Name:** ${name}`,
                symbol ? `**Symbol:** ${symbol}` : '',
                `**Rate:** 1 ${code} = ${eco.formatRate(usdRate)} USD`,
            ].filter(Boolean).join('\n');

            const container = buildContainer(lines, t.currencyCreated);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    },
};