import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
    TextChannel,
} from 'discord.js';
import { t } from '../../../lib/i18n';
import { getLoggingSettings, updateLoggingSettings } from '../../../lib/logging';
import { UserError } from '../../../lib/errors';

export async function handleConfigLogging(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const guild = interaction.guild!;
    const channel = interaction.options.getChannel('channel');
    const enable = interaction.options.getBoolean('enable');

    const current = await getLoggingSettings(guild.id);

    // Если ничего не указано — показать текущие настройки
    if (!channel && enable === null) {
        const channelMention = current.channelId
            ? `<#${current.channelId}>`
            : t(lang, 'config.logging.notSet');

        const embed = new EmbedBuilder()
            .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
            .setDescription(`### ${t(lang, 'config.logging.title')}`)
            .addFields({
                name: t(lang, 'config.currentSettings'),
                value: [
                    `${t(lang, 'config.logging.status')}: **${current.enabled ? t(lang, 'config.logging.on') : t(lang, 'config.logging.off')}**`,
                    `${t(lang, 'config.logging.channel')}: ${channelMention}`,
                ].join('\n'),
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
    }

    // Проверка канала
    if (channel && channel.type !== ChannelType.GuildText) {
        throw new UserError(t(lang, 'config.logging.notTextChannel'));
    }

    // Собираем патч
    const patch: { enabled?: boolean; channelId?: string } = {};
    let channelId = current.channelId;

    if (channel) {
        channelId = channel.id;
        patch.channelId = channel.id;
    }

    if (enable !== null) {
        // Нельзя включить без канала
        if (enable && !channelId) {
            throw new UserError(t(lang, 'config.logging.channelRequired'));
        }
        patch.enabled = enable;
    }

    const ok = await updateLoggingSettings(guild.id, patch);
    if (!ok) throw new UserError(t(lang, 'config.logging.saveError'));

    const channelMention = channelId
        ? `<#${channelId}>`
        : t(lang, 'config.logging.notSet');
    const nowEnabled = patch.enabled ?? current.enabled;

    const embed = new EmbedBuilder()
        .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
        .setDescription(`### ${t(lang, 'config.logging.title')}`)
        .addFields(
            {
                name: t(lang, 'config.currentSettings'),
                value: [
                    `${t(lang, 'config.logging.status')}: **${nowEnabled ? t(lang, 'config.logging.on') : t(lang, 'config.logging.off')}**`,
                    `${t(lang, 'config.logging.channel')}: ${channelMention}`,
                ].join('\n'),
            },
            {
                name: t(lang, 'config.info'),
                value: t(lang, 'config.logging.changedInfo'),
            },
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}