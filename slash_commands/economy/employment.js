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

function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

module.exports = {
    cooldown: 3,
    ephemeral: false,

    data: new SlashCommandBuilder()
        .setName('employment')
        .setDescription('Работа: получить зарплату')
        .addSubcommand(sub => sub
            .setName('daily')
            .setDescription('Раз в 24 часа: 6 USD (налог 6%)'))
        .addSubcommand(sub => sub
            .setName('timely')
            .setDescription('Раз в 12 часов: 2 USD (налог 6%)')),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        const result = await eco.claimEmployment(user.id, interaction.guildId, sub);

        // ── кулдаун ──
        if (!result.ok && result.reason === 'cooldown') {
            const embed = createAlertEmbed('warning', user,
                t.employmentCooldown(fmtTime(result.remaining)));
            return interaction.editReply({ embeds: [embed] });
        }
        if (!result.ok) {
            const embed = createAlertEmbed('error', user, t.errorOccurred);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── сколько начислить ──
        // у нас amount задан в USD. Начисляем в USD — юзер потом сам конвертит.
        const gross = result.amount;             // 6 или 2 USD
        const taxRate = eco.EMPLOYMENT_TAX;      // 0.06
        const taxAmount = gross * taxRate;
        const net = gross - taxAmount;

        // токен транзакции
        const token = await eco.createTransaction({
            userId: user.id,
            guildId: interaction.guildId,
            type: `employment_${sub}`,
            currency: 'USD',
            amount: gross,
            taxRate,
            meta: { source: 'employment', kind: sub },
        });

        await eco.addBalance(user.id, interaction.guildId, 'USD', net);
        await eco.bumpTaxRate(user.id, interaction.guildId);

        const next = sub === 'daily' ? '24 часа' : '12 часов';
        const lines = [
            `**${t.employmentEarned}:** +${eco.formatMoney(gross, 'USD')}`,
            `**${t.employmentTax} (${(taxRate * 100).toFixed(0)}%):** −${eco.formatMoney(taxAmount, 'USD')}`,
            `**${t.employmentNet}:** +${eco.formatMoney(net, 'USD')}`,
            `**${t.employmentNext}:** через ${next}`,
            '',
            `**${t.transactionToken}:** \`${token}\``,
        ].join('\n');

        const container = buildContainer(lines, `${t.employmentTitle} — ${sub}`);
        return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};