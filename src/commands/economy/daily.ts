import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import * as eco from '../../lib/economy';
import { getCurrency } from '../../lib/currency';
import { formatDate } from '../../lib/commandIds';

export default {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily bonus.')
        .setDescriptionLocalizations(getLocalizations('commands.daily.description')),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guildId = interaction.guildId!;
        const user = await eco.getUser(guildId, interaction.user.id);
        const cur = await getCurrency(guildId);

        const now = Date.now();
        const cd = eco.COOLDOWNS.daily;
        if (now - user.last_daily < cd) {
            const next = Math.floor((user.last_daily + cd) / 1000);
            throw new UserError(t(lang, 'economy.cooldown', { time: `<t:${next}:R>` }));
        }

        await eco.addMoney(guildId, user.user_id, eco.REWARDS.daily);
        await eco.updateUser(guildId, user.user_id, { last_daily: now });

        const next = Math.floor((now + cd) / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`${t(lang, 'economy.dailyTitle')} — ${interaction.user.username}`)
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
            .setDescription(
                t(lang, 'economy.dailyDescription', {
                    user: interaction.user.username,
                    amount: eco.REWARDS.daily,
                    currency: cur.emoji,
                }),
            )
            .addFields({
                name: t(lang, 'economy.nextBonus'),
                value: `<t:${next}:F>`,
            })
            .setFooter({ text: formatDate(now) });

        await interaction.editReply({ embeds: [embed] });
    },
};