import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageComponentInteraction,
} from 'discord.js';
import { MyClient } from '../../client';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import * as eco from '../../lib/economy';
import { getCurrency } from '../../lib/currency';
import { createCollector } from '../../lib/components';

const PAGE_SIZE = 10;
const MAX_PAGES = 5;

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Top users by balance.')
        .setDescriptionLocalizations(getLocalizations('commands.leaderboard.description')),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guildId = interaction.guildId!;
        const client = interaction.client as MyClient;
        const cur = await getCurrency(guildId);

        const buildPage = async (page: number) => {
            const { users } = await eco.getLeaderboard(guildId, page, PAGE_SIZE);

            const lines = await Promise.all(
                users.map(async (u, i) => {
                    const globalIdx = page * PAGE_SIZE + i;
                    const prefix = `#${globalIdx + 1}.`;

                    const member = await interaction.guild!.members
                        .fetch(u.user_id)
                        .catch(() => null);

                    const name = member?.user.username ?? 'unknown';
                    const total = u.wallet + u.bank;

                    return (
                        `${prefix} **${name}** (${u.user_id})\n` +
                        `${t(lang, 'economy.walletShort')}: ${eco.fmt(u.wallet)} ${cur.emoji} | ` +
                        `${t(lang, 'economy.bankShort')}: ${eco.fmt(u.bank)} ${cur.emoji} | ` +
                        `${t(lang, 'economy.totalShort')}: ${eco.fmt(total)} ${cur.emoji}`
                    );
                }),
            );

            const embed = new EmbedBuilder()
                .setTitle(t(lang, 'economy.leaderboardTitle'))
                .setDescription(lines.join('\n\n') || t(lang, 'economy.leaderboardEmpty'))
                .setFooter({
                    text: `${t(lang, 'economy.page')} ${page + 1}/${MAX_PAGES}`,
                })
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('lb_prev').setLabel('◀')
                    .setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('lb_next').setLabel('▶')
                    .setStyle(ButtonStyle.Secondary).setDisabled(page >= MAX_PAGES - 1),
            );

            return { embed, row };
        };

        const { embed, row } = await buildPage(0);
        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        let page = 0;
        createCollector(interaction.user.id, response, {
            lang,
            onCollect: async (i: MessageComponentInteraction) => {
                if (!i.isButton()) return;
                if (i.customId === 'lb_prev') page = Math.max(0, page - 1);
                else if (i.customId === 'lb_next') page = Math.min(MAX_PAGES - 1, page + 1);
                else return;

                const { embed, row } = await buildPage(page);
                await i.update({ embeds: [embed], components: [row] });
            },
        });
    },
};