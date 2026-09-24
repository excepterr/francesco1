import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
} from 'discord.js';
import { t } from '../../../lib/i18n';
import {
    getGuildSettings,
    updateBirthdaySettings,
} from '../../../lib/guildSettings';
import { UserError } from '../../../lib/errors';

export async function handleConfigBirthdays(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const guild = interaction.guild!;
    const channel = interaction.options.getChannel('channel');
    const enable = interaction.options.getBoolean('enable');

    const settings = await getGuildSettings(guild.id);

    // Если ничего не указано — показать текущие
    if (!channel && enable === null) {
        const channelMention = settings.birthday_channel_id
            ? `<#${settings.birthday_channel_id}>`
            : t(lang, 'config.birthdays.notSet');

        const embed = new EmbedBuilder()
            .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
            .setDescription(`### ${t(lang, 'config.birthdays.title')}`)
            .addFields({
                name: t(lang, 'config.currentSettings'),
                value: [
                    `${t(lang, 'config.birthdays.status')}: **${settings.birthday_enabled ? t(lang, 'config.birthdays.on') : t(lang, 'config.birthdays.off')}**`,
                    `${t(lang, 'config.birthdays.channel')}: ${channelMention}`,
                ].join('\n'),
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
    }

    if (channel && channel.type !== ChannelType.GuildText) {
        throw new UserError(t(lang, 'config.birthdays.notTextChannel'));
    }

    let channelId = settings.birthday_channel_id;
    let newEnabled = settings.birthday_enabled;

    if (channel) channelId = channel.id;

    if (enable !== null) {
        if (enable && !channelId) {
            throw new UserError(t(lang, 'config.birthdays.channelRequired'));
        }
        newEnabled = enable;
    }

    const ok = await updateBirthdaySettings(guild.id, newEnabled, channelId);
    if (!ok) throw new UserError(t(lang, 'config.birthdays.saveError'));

    const channelMention = channelId
        ? `<#${channelId}>`
        : t(lang, 'config.birthdays.notSet');

    const embed = new EmbedBuilder()
        .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
        .setDescription(`### ${t(lang, 'config.birthdays.title')}`)
        .addFields(
            {
                name: t(lang, 'config.currentSettings'),
                value: [
                    `${t(lang, 'config.birthdays.status')}: **${newEnabled ? t(lang, 'config.birthdays.on') : t(lang, 'config.birthdays.off')}**`,
                    `${t(lang, 'config.birthdays.channel')}: ${channelMention}`,
                ].join('\n'),
            },
            {
                name: t(lang, 'config.info'),
                value: t(lang, 'config.birthdays.changedInfo'),
            },
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}