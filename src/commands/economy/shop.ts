import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageComponentInteraction,
    PermissionFlagsBits,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import * as eco from '../../lib/economy';
import { createCollector } from '../../lib/components';
import { getCurrency } from '../../lib/currency';
import { formatDate } from '../../lib/commandIds';

const PAGE_SIZE = 10;

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Role shop.')
        .setDescriptionLocalizations(getLocalizations('commands.shop.description'))
        .addSubcommand((sub) =>
            sub.setName('list').setDescription('Show roles for sale.')
                .setDescriptionLocalizations(getLocalizations('commands.shop.list.description')),
        )
        .addSubcommand((sub) =>
            sub.setName('buy').setDescription('Buy a role.')
                .setDescriptionLocalizations(getLocalizations('commands.shop.buy.description'))
                .addRoleOption((o) =>
                    o.setName('role').setDescription('Role.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.shop.roleOption')),
                ),
        )
        .addSubcommand((sub) =>
            sub.setName('add').setDescription('Add a role to the shop.')
                .setDescriptionLocalizations(getLocalizations('commands.shop.add.description'))
                .addRoleOption((o) =>
                    o.setName('role').setDescription('Role.').setRequired(true),
                )
                .addIntegerOption((o) =>
                    o.setName('price').setDescription('Price.').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub.setName('remove').setDescription('Remove a role from the shop.')
                .setDescriptionLocalizations(getLocalizations('commands.shop.remove.description'))
                .addRoleOption((o) =>
                    o.setName('role').setDescription('Role.').setRequired(true),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guildId = interaction.guildId!;
        const sub = interaction.options.getSubcommand();

        // ===== ADD =====
        if (sub === 'add') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                throw new UserError(t(lang, 'errors.noPermission'));
            }
            const role = interaction.options.getRole('role', true);
            const price = interaction.options.getInteger('price', true);
            const ok = await eco.addShopRole(guildId, role.id, price);
            if (!ok) throw new UserError(t(lang, 'errors.generic'));

            const cur = await getCurrency(guildId);
            const now = Date.now();

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${t(lang, 'economy.shopAddTitle')} — ${interaction.user.username}`)
                        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                        .setDescription(
                            t(lang, 'economy.shopAddDescription', {
                                role: role.name,
                                price: eco.fmt(price),
                                currency: cur.emoji,
                            }),
                        )
                        .setFooter({ text: formatDate(now) }),
                ],
            });
            return;
        }

        // ===== REMOVE =====
        if (sub === 'remove') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                throw new UserError(t(lang, 'errors.noPermission'));
            }
            const role = interaction.options.getRole('role', true);
            await eco.removeShopRole(guildId, role.id);
            const now = Date.now();

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${t(lang, 'economy.shopRemoveTitle')} — ${interaction.user.username}`)
                        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                        .setDescription(
                            t(lang, 'economy.shopRemoveDescription', { role: role.name }),
                        )
                        .setFooter({ text: formatDate(now) }),
                ],
            });
            return;
        }

        // ===== BUY =====
        if (sub === 'buy') {
            const cur = await getCurrency(guildId);
            const now = Date.now();
            const role = interaction.options.getRole('role', true);
            const roles = await eco.getShopRoles(guildId);
            const entry = roles.find((r) => r.role_id === role.id);
            if (!entry) throw new UserError(t(lang, 'economy.shopRoleNotFound'));

            const user = await eco.getUser(guildId, interaction.user.id);
            const total = user.wallet + user.bank;
            if (total < entry.price) throw new UserError(t(lang, 'economy.notEnough'));

            const already = await eco.hasPurchased(guildId, user.user_id, role.id);
            if (already) throw new UserError(t(lang, 'economy.alreadyOwned'));

            // Списываем сначала с кошелька, потом с банка
            let remaining = entry.price;
            const fromWallet = Math.min(user.wallet, remaining);
            remaining -= fromWallet;
            const fromBank = Math.min(user.bank, remaining);

            await eco.updateUser(guildId, user.user_id, {
                wallet: user.wallet - fromWallet,
                bank: user.bank - fromBank,
            });
            await eco.addPurchase(guildId, user.user_id, role.id);

            const member = await interaction.guild!.members.fetch(interaction.user.id);
            await member.roles.add(role.id).catch(() => {});

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${t(lang, 'economy.shopBuyTitle')} — ${interaction.user.username}`)
                        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                        .setDescription(
                            t(lang, 'economy.shopBuyDescription', {
                                user: interaction.user.username,
                                role: role.name,
                                price: eco.fmt(entry.price),
                                currency: cur.emoji,
                            }),
                        )
                        .setFooter({ text: formatDate(now) }),
                ],
            });
            return;
        }

        // ===== LIST =====
        const roles = await eco.getShopRoles(guildId);
        const cur = await getCurrency(guildId);

        if (!roles.length) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(t(lang, 'economy.shopTitle'))
                        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                        .setDescription(t(lang, 'economy.shopEmpty')),
                ],
            });
            return;
        }

        const pages = Math.ceil(roles.length / PAGE_SIZE);

        const buildPage = (page: number) => {
            const slice = roles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
            const lines = slice.map((r, i) => {
                const idx = page * PAGE_SIZE + i + 1;
                return `**${idx}.** <@&${r.role_id}> — ${eco.fmt(r.price)} ${cur.emoji}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(t(lang, 'economy.shopTitle'))
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                .setDescription(lines.join('\n'))
                .setFooter({
                    text: `${t(lang, 'economy.page')} ${page + 1}/${pages}`,
                })
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('shop_prev').setLabel('◀')
                    .setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('shop_next').setLabel('▶')
                    .setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
            );

            return { embed, row };
        };

        const { embed, row } = buildPage(0);
        await interaction.reply({ embeds: [embed], components: [row] });
        const response = await interaction.fetchReply();

        if (pages <= 1) return;

        let page = 0;
        createCollector(interaction.user.id, response, {
            lang,
            onCollect: async (i: MessageComponentInteraction) => {
                if (!i.isButton()) return;
                if (i.customId === 'shop_prev') page = Math.max(0, page - 1);
                else if (i.customId === 'shop_next') page = Math.min(pages - 1, page + 1);
                else return;

                const { embed, row } = buildPage(page);
                await i.update({ embeds: [embed], components: [row] });
            },
        });
    },
};