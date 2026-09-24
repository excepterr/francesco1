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
        .setName('bank')
        .setDescription('Manage your bank account.')
        .setDescriptionLocalizations(getLocalizations('commands.bank.description'))
        .addSubcommand((sub) =>
            sub
                .setName('deposit')
                .setDescription('Deposit money into your bank.')
                .setDescriptionLocalizations(getLocalizations('commands.bank.deposit.description'))
                .addIntegerOption((o) =>
                    o.setName('amount').setDescription('Amount or 0 for all.')
                        .setMinValue(0).setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.bank.amountOption')),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('withdraw')
                .setDescription('Withdraw money from your bank.')
                .setDescriptionLocalizations(getLocalizations('commands.bank.withdraw.description'))
                .addIntegerOption((o) =>
                    o.setName('amount').setDescription('Amount or 0 for all.')
                        .setMinValue(0).setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.bank.amountOption')),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guildId = interaction.guildId!;
        const sub = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger('amount', true);
        const user = await eco.getUser(guildId, interaction.user.id);
        const cur = await getCurrency(guildId);
        const now = Date.now();

        const buildEmbed = (titleKey: string, descKey: string, value: number) =>
            new EmbedBuilder()
                .setTitle(`${t(lang, titleKey)} — ${interaction.user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                .setDescription(
                    t(lang, descKey, {
                        user: interaction.user.username,
                        amount: eco.fmt(value),
                        currency: cur.emoji,
                    }),
                )
                .setFooter({ text: formatDate(now) });

        if (sub === 'deposit') {
            const value = amount === 0 ? user.wallet : amount;
            if (value <= 0) throw new UserError(t(lang, 'economy.bankNothing'));
            if (user.wallet < value) throw new UserError(t(lang, 'economy.notEnough'));

            await eco.updateUser(guildId, user.user_id, {
                wallet: user.wallet - value,
                bank: user.bank + value,
            });

            await interaction.editReply({
                embeds: [buildEmbed('economy.bankDepositTitle', 'economy.bankDepositDescription', value)],
            });
            return;
        }

        const value = amount === 0 ? user.bank : amount;
        if (value <= 0) throw new UserError(t(lang, 'economy.bankNothing'));
        if (user.bank < value) throw new UserError(t(lang, 'economy.notEnough'));

        await eco.updateUser(guildId, user.user_id, {
            wallet: user.wallet + value,
            bank: user.bank - value,
        });

        await interaction.editReply({
            embeds: [buildEmbed('economy.bankWithdrawTitle', 'economy.bankWithdrawDescription', value)],
        });
    },
};