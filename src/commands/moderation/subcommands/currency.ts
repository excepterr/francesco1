import {
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { t } from '../../../lib/i18n';
import { getCurrency, updateCurrency } from '../../../lib/currency';
import { UserError } from '../../../lib/errors';

export async function handleConfigCurrency(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const guildId = interaction.guildId!;
    const emoji = interaction.options.getString('emoji');
    const name = interaction.options.getString('name');

    const current = await getCurrency(guildId);

    // Показать текущие настройки
    if (!emoji && !name) {
        const embed = new EmbedBuilder()
            .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
            .setDescription(`### ${t(lang, 'config.currency.title')}`)
            .addFields({
                name: t(lang, 'config.currentSettings'),
                value: [
                    `${t(lang, 'config.currency.emoji')}: ${current.emoji}`,
                    `${t(lang, 'config.currency.name')}: **${current.name}**`,
                ].join('\n'),
            })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const patch: { emoji?: string; name?: string } = {};
    if (emoji) patch.emoji = emoji.slice(0, 50);
    if (name) patch.name = name.slice(0, 32);

    const ok = await updateCurrency(guildId, patch);
    if (!ok) throw new UserError(t(lang, 'config.currency.saveError'));

    const updated = await getCurrency(guildId);

    const embed = new EmbedBuilder()
        .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
        .setDescription(`### ${t(lang, 'config.currency.title')}`)
        .addFields(
            {
                name: t(lang, 'config.currentSettings'),
                value: [
                    `${t(lang, 'config.currency.emoji')}: ${updated.emoji}`,
                    `${t(lang, 'config.currency.name')}: **${updated.name}**`,
                ].join('\n'),
            },
            {
                name: t(lang, 'config.info'),
                value: t(lang, 'config.currency.changedInfo'),
            },
        )
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}