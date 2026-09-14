const {
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
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
        .setName('balance')
        .setDescription('Баланс и актуальные курсы валют')
        .addUserOption(o => o.setName('user').setDescription('Пользователь (по умолчанию — вы)'))
        .addStringOption(o => o.setName('scope').setDescription('Тип рынка')
            .addChoices(
                { name: 'Локальный', value: 'local' },
                { name: 'Глобальный', value: 'global' },
            )),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        const target = interaction.options.getUser('user') ?? user;
        const scope = interaction.options.getString('scope') ?? 'local';

        // ── курсы фиата ──
        const bases = await eco.getBaseCurrencies();
        const srv = await eco.getServerCurrency(interaction.guildId);
        const cryptos = await eco.getCryptoCurrencies();

        const fiat = srv ? [...bases, srv] : [...bases];
        fiat.sort((a, b) => a.code.localeCompare(b.code));

        const cryptoSorted = [...cryptos].sort((a, b) => a.code.localeCompare(b.code));

        const all = [...fiat, ...cryptoSorted];


        // ── баланс (в USD) + валюта показа ──
        const bal = await eco.getDisplayBalance(target.id, interaction.guildId);
        const balUSD = bal.amountUSD;

        // ── таблица курсов ──
        const lines = [];
        lines.push('#     1 unit → USD    1 USD → units');
        lines.push('─'.repeat(42));
        for (const c of all) {
            const mark = c.code === bal.code ? '▸' : ' ';
            const rateStr = eco.formatRate(c.rate_usd).padEnd(14);
            const inverse = (1 / c.rate_usd).toFixed(4).padEnd(12);
            lines.push(`${mark} ${c.code.padEnd(4)} ${rateStr}${inverse}`);
        }

        // ── шапка ──
        const sym = all.find(c => c.code === bal.code)?.symbol ?? bal.code;
        const balStr = `${bal.amount.toFixed(4)} ${sym}`;

        const header = [
            `**${t.balanceTitle}**`,
            `${t.balanceScope}: ${scope === 'global' ? t.balanceGlobal : t.balanceLocal}`,
            '',
            `💵 **${t.balancePreferred}: ${bal.code}**`,
            `📊 ${t.balanceInPreferred}: **${balStr}**`,
            `🌐 ${t.balanceInUSD}: **${balUSD.toFixed(4)} USD**`,
            '',
        ].join('\n');

        const title = target.id === user.id
            ? `${t.balanceTitle} — ${user.username}`
            : `${t.balanceTitle} — ${target.username}`;

        const container = buildContainer(
            header + '```\n' + lines.join('\n') + '\n```',
            title,
        );

        return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};