import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import * as eco from '../../lib/economy';
import { getCurrency } from '../../lib/currency';
import { pingCommand } from '../../lib/commandIds';

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Show your or another user\'s balance.')
        .setDescriptionLocalizations(getLocalizations('commands.balance.description'))
        .addUserOption((o) =>
            o.setName('user').setDescription('User.')
                .setDescriptionLocalizations(getLocalizations('commands.balance.userOption')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guildId = interaction.guildId!;
        const target = interaction.options.getUser('user') ?? interaction.user;

        const user = await eco.getUser(guildId, target.id);
        const cur = await getCurrency(guildId);
        const total = user.wallet + user.bank;

        // Все три команды всегда показываются
        const rewards = [
            pingCommand('timely'),
            pingCommand('daily'),
            pingCommand('weekly'),
        ].join(' ');

        const description = [
            `**${t(lang, 'economy.wallet')}**: ${eco.fmt(user.wallet)} ${cur.emoji}`,
            `**${t(lang, 'economy.bank')}**: ${eco.fmt(user.bank)} ${cur.emoji}`,
            `**${t(lang, 'economy.total')}**: ${eco.fmt(total)} ${cur.emoji}`,
            ``,
            `**${t(lang, 'economy.donateCurrency')}**`,
            `${eco.fmt(user.hellcoin)}`,
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle(t(lang, 'economy.balanceTitle', { user: target.username }))
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setDescription(description)
            .addFields({
                name: t(lang, 'economy.info'),
                value: t(lang, 'economy.rewardsAvailable', { list: rewards }),
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};