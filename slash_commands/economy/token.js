const {
    SlashCommandBuilder, EmbedBuilder, ContainerBuilder, TextDisplayBuilder,
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
        .setName('token')
        .setDescription('Работа с токенами транзакций')
        .addSubcommand(sub => sub
            .setName('show')
            .setDescription('Показать информацию о транзакции по токену')
            .addStringOption(o => o.setName('token').setDescription('UUID токена').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('block')
            .setDescription('[ADMIN] Заблокировать транзакцию')
            .addStringOption(o => o.setName('token').setDescription('UUID токена').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Причина блокировки'))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        // ═══════ SHOW ═══════
        if (sub === 'show') {
            const token = interaction.options.getString('token').trim();
            if (!/^[0-9a-f-]{36}$/i.test(token)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.tokenInvalid)] });
            }

            const tx = await eco.getTransaction(token);
            if (!tx) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.tokenNotFound)] });
            }

            const createdTs = Math.floor(new Date(tx.created_at).getTime() / 1000);

            const lines = [
                `**${t.tokenType}:** \`${tx.type}\``,
                `**${t.tokenUser}:** <@${tx.user_id}> (\`${tx.user_id}\`)`,
                `**${t.tokenGuild}:** \`${tx.guild_id}\``,
                `**${t.tokenCurrency}:** \`${tx.currency_code}\``,
                `**${t.tokenAmount}:** ${eco.formatMoney(parseFloat(tx.amount), tx.currency_code)}`,
                `**${t.tokenTax} (${(parseFloat(tx.tax_rate) * 100).toFixed(2)}%):** ${eco.formatMoney(parseFloat(tx.tax_amount), tx.currency_code)}`,
                `**${t.tokenNet}:** ${eco.formatMoney(parseFloat(tx.net_amount ?? tx.amount), tx.currency_code)}`,
                `**${t.tokenDate}:** <t:${createdTs}:f>`,
            ];

            if (tx.blocked) {
                const blockedTs = tx.blocked_at ? Math.floor(new Date(tx.blocked_at).getTime() / 1000) : null;
                lines.push('');
                lines.push(`🚫 **${t.tokenBlocked}**`);
                if (tx.blocked_by) lines.push(`**${t.tokenBlockedBy}:** <@${tx.blocked_by}>`);
                if (blockedTs) lines.push(`**${t.tokenBlockedAt}:** <t:${blockedTs}:f>`);
                if (tx.block_reason) lines.push(`**${t.tokenBlockReason}:** ${tx.block_reason}`);
            } else {
                lines.push('');
                lines.push(`✅ **${t.tokenActive}**`);
            }

            const container = buildContainer(lines.join('\n'), `${t.tokenTitle} — ${token.slice(0, 8)}…`);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ BLOCK ═══════
        if (sub === 'block') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
            }

            const token = interaction.options.getString('token').trim();
            const reason = interaction.options.getString('reason') ?? null;

            if (!/^[0-9a-f-]{36}$/i.test(token)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.tokenInvalid)] });
            }

            const tx = await eco.getTransaction(token);
            if (!tx) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.tokenNotFound)] });
            }

            if (tx.blocked) {
                return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.tokenAlreadyBlocked)] });
            }

            const updated = await eco.blockTransaction(token, user.id, reason);
            if (!updated) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.errorOccurred)] });
            }

            const lines = [
                `**${t.tokenType}:** \`${tx.type}\``,
                `**${t.tokenUser}:** <@${tx.user_id}>`,
                `**${t.tokenAmount}:** ${eco.formatMoney(parseFloat(tx.amount), tx.currency_code)}`,
                reason ? `**${t.tokenBlockReason}:** ${reason}` : '',
                '',
                `**${t.tokenBlockedBy}:** <@${user.id}>`,
            ].filter(Boolean).join('\n');

            const container = buildContainer(lines, `🚫 ${t.tokenBlockSuccess}`);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    },
};