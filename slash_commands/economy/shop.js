const {
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const supabase = require('../../utils/supabase');
const eco = require('../../utils/economy');

const PAGE_SIZE = 10;

function buildShopContainer(items, page, total, t, userId) {
    const c = new ContainerBuilder().setAccentColor(null);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${t.shopTitle} — ${page + 1}/${total}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    if (items.length === 0) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*${t.shopEmpty}*`));
    } else {
        const lines = items.map((it, i) => {
            const idx = page * PAGE_SIZE + i + 1;
            return `${idx}. <@&${it.role_id}> — ${eco.formatMoney(parseFloat(it.price), it.currency_code)}`;
        });
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
    }

    // кнопки страниц
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`shop_prev:${userId}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
        new ButtonBuilder().setCustomId(`shop_buy:${userId}`).setLabel(t.shopBtnBuy).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`shop_next:${userId}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= total - 1),
    );
    c.addActionRowComponents(navRow);

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`));
    return c;
}

async function getShopList(guildId) {
    const { data } = await supabase
        .from('shop_roles')
        .select('*')
        .eq('guild_id', guildId)
        .order('price', { ascending: true });
    return data ?? [];
}

async function renderShop(client, interaction, page, edit = false) {
    const { lang } = await getSettings(interaction.guildId);
    const t = client.locales[lang] ?? client.locales.ru;
    const list = await getShopList(interaction.guildId);

    if (list.length === 0) {
        const embed = createAlertEmbed('warning', interaction.user, t.shopEmpty);
        if (edit) return interaction.editReply({ embeds: [embed] });
        return interaction.editReply({ embeds: [embed] });
    }

    const total = Math.ceil(list.length / PAGE_SIZE);
    page = Math.max(0, Math.min(total - 1, page));
    const items = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const container = buildShopContainer(items, page, total, t, interaction.user.id);

    if (edit) return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

module.exports = {
    cooldown: 4,
    ephemeral: false,
    botPermissions: ['ManageRoles', 'Встраивать ссылки'],

    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Магазин ролей')
        .addSubcommand(sub => sub
            .setName('showlist')
            .setDescription('Показать список ролей в магазине'))
        .addSubcommand(sub => sub
            .setName('buy')
            .setDescription('Купить роль за валюту')
            .addRoleOption(o => o.setName('role').setDescription('Роль для покупки').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('addrole')
            .setDescription('[ADMIN] Добавить роль в магазин')
            .addRoleOption(o => o.setName('role').setDescription('Роль').setRequired(true))
            .addNumberOption(o => o.setName('price').setDescription('Цена').setRequired(true).setMinValue(0.01))
            .addStringOption(o => o.setName('currency').setDescription('Валюта (USD/EUR/...)').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('removerole')
            .setDescription('[ADMIN] Убрать роль из магазина')
            .addRoleOption(o => o.setName('role').setDescription('Роль').setRequired(true))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        // ═══════ SHOWLIST ═══════
        if (sub === 'showlist') {
            return renderShop(client, interaction, 0, false);
        }

        // ═══════ BUY ═══════
        if (sub === 'buy') {
            const role = interaction.options.getRole('role');

            const { data: item } = await supabase
                .from('shop_roles')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('role_id', role.id)
                .maybeSingle();

            if (!item) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.shopItemNotFound)],
                });
            }

            const price = parseFloat(item.price);
            const currency = item.currency_code;

            // проверка баланса
            const bal = await eco.getBalance(user.id, interaction.guildId, currency);
            if (bal < price) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user,
                        t.shopNotEnough(eco.formatMoney(price, currency), eco.formatMoney(bal, currency)))],
                });
            }

            // проверка что роль не выдана
            const member = await interaction.guild.members.fetch(user.id);
            if (member.roles.cache.has(role.id)) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('warning', user, t.shopAlreadyOwned)],
                });
            }

            // проверка прав бота
            const me = interaction.guild.members.me;
            if (!me.permissions.has(PermissionFlagsBits.ManageRoles) || me.roles.highest.position <= role.position) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.shopBotCantAssign)],
                });
            }

            // налог
            const taxRate = await eco.getTaxRate(user.id, interaction.guildId);
            const taxAmount = price * taxRate;
            const totalCost = price + taxAmount;

            if (bal < totalCost) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user,
                        t.shopNotEnoughTax(
                            eco.formatMoney(price, currency),
                            eco.formatMoney(taxAmount, currency),
                            eco.formatMoney(totalCost, currency),
                            eco.formatMoney(bal, currency),
                        ))],
                });
            }

            // токен транзакции
            const token = await eco.createTransaction({
                userId: user.id,
                guildId: interaction.guildId,
                type: 'shop_buy',
                currency,
                amount: totalCost,
                taxRate,
                meta: { role_id: role.id, role_name: role.name, base_price: price, tax_amount: taxAmount },
            });

            // списываем, выдаём роль
            await eco.subBalance(user.id, interaction.guildId, currency, totalCost);
            await eco.bumpTaxRate(user.id, interaction.guildId);

            try {
                await member.roles.add(role, `Shop purchase | ${user.tag}`);
            } catch (err) {
                console.error('shop add role error:', err);
                // откатываем транзакцию
                await eco.addBalance(user.id, interaction.guildId, currency, totalCost);
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user, t.shopAssignFailed)],
                });
            }

            await supabase.from('shop_purchases').insert({
                guild_id: interaction.guildId,
                user_id: user.id,
                role_id: role.id,
                tx_token: token,
            });

            const c = new ContainerBuilder().setAccentColor(null);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${t.shopPurchased}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
                `**${t.shopRole}:** <@&${role.id}>`,
                `**${t.shopPrice}:** ${eco.formatMoney(price, currency)}`,
                `**${t.shopTax} (${(taxRate * 100).toFixed(1)}%):** +${eco.formatMoney(taxAmount, currency)}`,
                `**${t.shopTotal}:** ${eco.formatMoney(totalCost, currency)}`,
                '',
                `**${t.transactionToken}:** \`${token}\``,
            ].join('\n')));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`));

            return interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        // ═══════ ADDROLE ═══════
        if (sub === 'addrole') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
            }

            const role = interaction.options.getRole('role');
            const price = interaction.options.getNumber('price');
            const currency = (interaction.options.getString('currency') ?? 'USD').toUpperCase();

            if (role.managed || role.id === interaction.guild.id) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.shopInvalidRole)] });
            }

            const rate = await eco.getRate(currency, interaction.guildId);
            if (rate == null) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.shopUnknownCurrency)] });
            }

            // upsert
            const { data: existing } = await supabase
                .from('shop_roles')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('role_id', role.id)
                .maybeSingle();

            if (existing) {
                await supabase.from('shop_roles')
                    .update({ price, currency_code: currency })
                    .eq('id', existing.id);
            } else {
                await supabase.from('shop_roles').insert({
                    guild_id: interaction.guildId,
                    role_id: role.id,
                    price,
                    currency_code: currency,
                });
            }

            return interaction.editReply({
                embeds: [createAlertEmbed('success', user,
                    t.shopAdded(role.toString(), eco.formatMoney(price, currency)))],
            });
        }

        // ═══════ REMOVEROLE ═══════
        if (sub === 'removerole') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
            }

            const role = interaction.options.getRole('role');

            const { data: existing } = await supabase
                .from('shop_roles')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('role_id', role.id)
                .maybeSingle();

            if (!existing) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('warning', user, t.shopItemNotFound)],
                });
            }

            await supabase.from('shop_roles').delete().eq('id', existing.id);

            return interaction.editReply({
                embeds: [createAlertEmbed('success', user, t.shopRemoved(role.toString()))],
            });
        }
    },

    components: {
        // ─── листаем ───
        shop_prev: async (client, interaction) => {
            const userId = interaction.customId.split(':')[1];
            if (userId !== interaction.user.id) return;
            await interaction.deferUpdate();

            // вытащим текущую страницу из сообщения (парсим title)
            const shop = await getShopList(interaction.guildId);
            const total = Math.max(1, Math.ceil(shop.length / PAGE_SIZE));

            // ищем текущую страницу по кнопке (в component state не хранится, но можно взять из текста)
            // Проще: сохраню в client замыкании
            // Но т.к. это stateless, посмотрим на название — либо добавим state на сообщение.
            // Упростим: считаем, что пользователь листает по кругу. Определим текущую страницу из client.shopPages.

            if (!client.shopPages) client.shopPages = new Map();
            const key = `${interaction.guildId}:${interaction.message.id}`;
            const current = client.shopPages.get(key) ?? 0;
            const next = Math.max(0, current - 1);
            client.shopPages.set(key, next);

            return renderShop(client, interaction, next, true);
        },
        shop_next: async (client, interaction) => {
            const userId = interaction.customId.split(':')[1];
            if (userId !== interaction.user.id) return;
            await interaction.deferUpdate();

            const shop = await getShopList(interaction.guildId);
            const total = Math.max(1, Math.ceil(shop.length / PAGE_SIZE));

            if (!client.shopPages) client.shopPages = new Map();
            const key = `${interaction.guildId}:${interaction.message.id}`;
            const current = client.shopPages.get(key) ?? 0;
            const next = Math.min(total - 1, current + 1);
            client.shopPages.set(key, next);

            return renderShop(client, interaction, next, true);
        },
        shop_buy: async (client, interaction) => {
            const userId = interaction.customId.split(':')[1];
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;

            if (userId !== interaction.user.id) {
                return interaction.reply({
                    embeds: [createAlertEmbed('error', interaction.user, t.notOwner)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`shop_buy_modal:${userId}`)
                .setTitle(t.shopBuyModalTitle)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('role_input')
                            .setLabel(t.shopBuyModalLabel)
                            .setPlaceholder('@role или ID')
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(100)
                            .setRequired(true),
                    ),
                );

            return interaction.showModal(modal);
        },
        shop_buy_modal: async (client, interaction) => {
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const user = interaction.user;

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const raw = interaction.fields.getTextInputValue('role_input').trim();
            const id = raw.match(/(\d{17,20})/)?.[1];
            if (!id) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.shopInvalidRole)] });
            }

            const role = interaction.guild.roles.cache.get(id);
            if (!role) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.shopInvalidRole)] });
            }

            const { data: item } = await supabase
                .from('shop_roles')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('role_id', role.id)
                .maybeSingle();

            if (!item) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.shopItemNotFound)] });
            }

            const price = parseFloat(item.price);
            const currency = item.currency_code;
            const bal = await eco.getBalance(user.id, interaction.guildId, currency);

            if (bal < price) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user,
                        t.shopNotEnough(eco.formatMoney(price, currency), eco.formatMoney(bal, currency)))],
                });
            }

            const member = await interaction.guild.members.fetch(user.id);
            if (member.roles.cache.has(role.id)) {
                return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.shopAlreadyOwned)] });
            }

            const me = interaction.guild.members.me;
            if (!me.permissions.has(PermissionFlagsBits.ManageRoles) || me.roles.highest.position <= role.position) {
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.shopBotCantAssign)] });
            }

            const taxRate = await eco.getTaxRate(user.id, interaction.guildId);
            const taxAmount = price * taxRate;
            const totalCost = price + taxAmount;

            if (bal < totalCost) {
                return interaction.editReply({
                    embeds: [createAlertEmbed('error', user,
                        t.shopNotEnoughTax(
                            eco.formatMoney(price, currency),
                            eco.formatMoney(taxAmount, currency),
                            eco.formatMoney(totalCost, currency),
                            eco.formatMoney(bal, currency),
                        ))],
                });
            }

            const token = await eco.createTransaction({
                userId: user.id,
                guildId: interaction.guildId,
                type: 'shop_buy',
                currency,
                amount: totalCost,
                taxRate,
                meta: { role_id: role.id, role_name: role.name, base_price: price, tax_amount: taxAmount },
            });

            await eco.subBalance(user.id, interaction.guildId, currency, totalCost);
            await eco.bumpTaxRate(user.id, interaction.guildId);

            try {
                await member.roles.add(role, `Shop purchase | ${user.tag}`);
            } catch (err) {
                console.error('shop add role error:', err);
                await eco.addBalance(user.id, interaction.guildId, currency, totalCost);
                return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.shopAssignFailed)] });
            }

            await supabase.from('shop_purchases').insert({
                guild_id: interaction.guildId,
                user_id: user.id,
                role_id: role.id,
                tx_token: token,
            });

            const c = new ContainerBuilder().setAccentColor(null);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${t.shopPurchased}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
                `**${t.shopRole}:** <@&${role.id}>`,
                `**${t.shopPrice}:** ${eco.formatMoney(price, currency)}`,
                `**${t.shopTax} (${(taxRate * 100).toFixed(1)}%):** +${eco.formatMoney(taxAmount, currency)}`,
                `**${t.shopTotal}:** ${eco.formatMoney(totalCost, currency)}`,
                '',
                `**${t.transactionToken}:** \`${token}\``,
            ].join('\n')));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`));

            return interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        },
    },
};