const {
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const supabase = require('../../utils/supabase');
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
        .setName('p2p')
        .setDescription('P2P-рынок валют')
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Показать активные предложения')
            .addStringOption(o => o.setName('scope').setDescription('Рынок').setRequired(false)
                .addChoices({ name: 'Локальный', value: 'local' }, { name: 'Глобальный', value: 'global' })))
        .addSubcommand(sub => sub
            .setName('sell')
            .setDescription('Выставить валюту на продажу')
            .addStringOption(o => o.setName('currency').setDescription('Какую валюту продаёшь').setRequired(true))
            .addNumberOption(o => o.setName('amount').setDescription('Сколько единиц').setRequired(true).setMinValue(0.01))
            .addNumberOption(o => o.setName('price').setDescription('Сколько USD хочешь за всё').setRequired(true).setMinValue(0.01)))
        .addSubcommand(sub => sub
            .setName('buy')
            .setDescription('Купить лот по ID')
            .addStringOption(o => o.setName('id').setDescription('UUID листинга').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('mylistings')
            .setDescription('Мои активные лоты'))
        .addSubcommand(sub => sub
            .setName('cancel')
            .setDescription('Отменить лот')
            .addStringOption(o => o.setName('id').setDescription('UUID листинга').setRequired(true))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        // ═══════ LIST ═══════
        if (sub === 'list') {
            const scope = interaction.options.getString('scope') ?? 'local';
            let query = supabase.from('p2p_listings').select('*').eq('status', 'open');
            if (scope === 'local') query = query.eq('guild_id', interaction.guildId);
            const { data: listings } = await query.order('created_at', { ascending: false }).limit(50);

            if (!listings || listings.length === 0) {
                return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.p2pNoListings)] });
            }

            const lines = listings.map(l => {
                const amount = parseFloat(l.amount);
                const price = parseFloat(l.price_usd);
                const perUnit = price / amount;
                return `\`${l.id.slice(0, 8)}…\` — **${amount} ${l.currency_code}** за **${price.toFixed(4)} USD**\n    от <@${l.seller_id}> · ${perUnit.toFixed(6)} USD / ед.`;
            });

            const container = buildContainer(lines.join('\n\n'), `${t.p2pTitle} (${listings.length})`);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ SELL ═══════
        if (sub === 'sell') {
            const currency = interaction.options.getString('currency').toUpperCase().trim();
            const amount = interaction.options.getNumber('amount');
            const priceUsd = interaction.options.getNumber('price');

            const rate = await eco.getRate(currency, interaction.guildId);
            if (rate == null) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.currencyUnknown)] });
            }

            // проверяем, что у юзера есть столько валюты
            const bal = await eco.getDisplayBalance(user.id, interaction.guildId, currency);
            if (bal.amount < amount) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user,
                        t.p2pNotEnough(eco.formatMoney(amount, currency), eco.formatMoney(bal.amount, currency)))],
                });
            }

            // списываем с баланса (замораживаем)
            await eco.subBalance(user.id, interaction.guildId, currency, amount);

            const { data, error } = await supabase.from('p2p_listings').insert({
                seller_id: user.id,
                guild_id: interaction.guildId,
                currency_code: currency,
                amount,
                price_usd: priceUsd,
                status: 'open',
            }).select('*').single();

            if (error) {
                await eco.addBalance(user.id, interaction.guildId, currency, amount);
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.errorOccurred)] });
            }

            const lines = [
                `**ID:** \`${data.id}\``,
                `**${t.p2pAmount}:** ${eco.formatMoney(amount, currency)}`,
                `**${t.p2pPrice}:** ${priceUsd.toFixed(4)} USD`,
                `**${t.p2pRate}:** ${(priceUsd / amount).toFixed(6)} USD / ед.`,
            ].join('\n');

            const container = buildContainer(lines, t.p2pListed);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ BUY ═══════
        if (sub === 'buy') {
            const idInput = interaction.options.getString('id').trim();

            // найдём лот по префиксу или полному UUID
            const { data: listings } = await supabase.from('p2p_listings')
                .select('*').eq('status', 'open')
                .or(`id.eq.${idInput},id::text.ilike.${idInput}%`);

            const listing = listings?.[0];
            if (!listing) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.p2pNotFound)] });
            }

            if (listing.seller_id === user.id) {
                return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.p2pOwnListing)] });
            }

            const priceUsd = parseFloat(listing.price_usd);
            const amount = parseFloat(listing.amount);

            const buyerBal = await eco.getBalanceUSD(user.id, interaction.guildId);
            if (buyerBal < priceUsd) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user,
                        t.p2pBuyerNotEnough(priceUsd.toFixed(4), buyerBal.toFixed(4)))],
                });
            }

            // транзакции (облагаются налогом)
            const taxRate = await eco.getTaxRate(user.id, interaction.guildId);
            const tax = priceUsd * taxRate;
            const totalCost = priceUsd + tax;

            if (buyerBal < totalCost) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user,
                        t.p2pBuyerNotEnoughWithTax(totalCost.toFixed(4), tax.toFixed(4), buyerBal.toFixed(4)))],
                });
            }

            const buyToken = await eco.createTransaction({
                userId: user.id,
                guildId: interaction.guildId,
                type: 'p2p_buy',
                currency: 'USD',
                amount: totalCost,
                taxRate,
                meta: { listing_id: listing.id, seller_id: listing.seller_id, amount, currency: listing.currency_code },
                logFn: (token, tx) => require('../../utils/economyLog').logTransaction(client, { token, ...tx }),
            });

            // списываем USD у покупателя
            await eco.subBalance(user.id, interaction.guildId, 'USD', totalCost);
            // начисляем валюту покупателю
            await eco.addBalance(user.id, interaction.guildId, listing.currency_code, amount);
            // продавцу — USD
            await eco.addBalanceUSD(listing.seller_id, listing.guild_id, priceUsd);

            await eco.bumpTaxRate(user.id, interaction.guildId);

            // обновляем статус
            await supabase.from('p2p_listings').update({
                status: 'sold',
                buyer_id: user.id,
                sold_at: new Date().toISOString(),
            }).eq('id', listing.id);

            const lines = [
                `**${t.p2pAmount}:** ${eco.formatMoney(amount, listing.currency_code)}`,
                `**${t.p2pPrice}:** ${priceUsd.toFixed(4)} USD`,
                `**${t.p2pTax}:** ${tax.toFixed(4)} USD`,
                `**${t.p2pTotal}:** ${totalCost.toFixed(4)} USD`,
                `**${t.p2pSeller}:** <@${listing.seller_id}>`,
                '',
                `**${t.transactionToken}:** \`${buyToken}\``,
            ].join('\n');

            const container = buildContainer(lines, t.p2pBought);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ MYLISTINGS ═══════
        if (sub === 'mylistings') {
            const { data: listings } = await supabase.from('p2p_listings')
                .select('*').eq('seller_id', user.id).eq('status', 'open')
                .order('created_at', { ascending: false });

            if (!listings || listings.length === 0) {
                return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.p2pNoListings)] });
            }

            const lines = listings.map(l =>
                `\`${l.id.slice(0, 8)}…\` — **${parseFloat(l.amount)} ${l.currency_code}** за **${parseFloat(l.price_usd).toFixed(4)} USD**`
            );

            const container = buildContainer(lines.join('\n'), `${t.p2pMyListings} (${listings.length})`);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ CANCEL ═══════
        if (sub === 'cancel') {
            const idInput = interaction.options.getString('id').trim();
            const { data: listings } = await supabase.from('p2p_listings')
                .select('*').eq('seller_id', user.id).eq('status', 'open')
                .or(`id.eq.${idInput},id::text.ilike.${idInput}%`);

            const listing = listings?.[0];
            if (!listing) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.p2pNotFound)] });
            }

            // возвращаем замороженную валюту
            await eco.addBalance(user.id, interaction.guildId, listing.currency_code, parseFloat(listing.amount));
            await supabase.from('p2p_listings').update({ status: 'cancelled' }).eq('id', listing.id);

            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.p2pCancelled)],
            });
        }
    },
};