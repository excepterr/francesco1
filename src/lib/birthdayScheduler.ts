import cron from 'node-cron';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { MyClient } from '../client';
import { supabase } from './supabase';
import { getEnabledBirthdayGuilds } from './guildSettings';
import { t } from './i18n';

/**
 * Запускает cron-задачу: каждый день в 09:00 UTC
 * проверяет, у кого сегодня день рождения, и поздравляет.
 */
export function startBirthdayScheduler(client: MyClient) {
    // '0 9 * * *' = каждый день в 09:00
    // timezone UTC — фиксированное время, одинаковое для всех серверов
    cron.schedule(
        '0 9 * * *',
        () => {
            runBirthdayCheck(client).catch((e) =>
                console.error('[CRON] Ошибка проверки ДР:', e),
            );
        },
        { timezone: 'UTC' },
    );

    console.log('[CRON] Планировщик ДР запущен (каждый день в 09:00 UTC)');
}

export async function runBirthdayCheck(client: MyClient) {
    const now = new Date();
    const day = now.getUTCDate();
    const month = now.getUTCMonth() + 1;

    console.log(`[CRON] Проверка ДР на ${day}.${month}...`);

    const guilds = await getEnabledBirthdayGuilds();
    console.log(`[CRON] Серверов с включёнными ДР: ${guilds.length}`);

    for (const settings of guilds) {
        if (!settings.birthday_channel_id) continue;

        const guild = client.guilds.cache.get(settings.guild_id);
        if (!guild) continue;

        const channel = guild.channels.cache.get(settings.birthday_channel_id);
        if (!channel || !(channel instanceof TextChannel)) continue;

        // Ищем именинников на сегодня
        const { data: birthdays, error } = await supabase
            .from('birthdays')
            .select('user_id')
            .eq('guild_id', settings.guild_id)
            .eq('day', day)
            .eq('month', month);

        if (error || !birthdays || birthdays.length === 0) continue;

        // Фильтруем тех, кто ещё на сервере
        const validIds: string[] = [];
        for (const b of birthdays) {
            const member = await guild.members
                .fetch(b.user_id)
                .catch(() => null);
            if (member) validIds.push(b.user_id);
        }
        if (validIds.length === 0) continue;

        const mentions = validIds.map((id) => `<@${id}>`).join(', ');

        const lang = settings.language ?? 'en';
        const embed = new EmbedBuilder()
            .setTitle(t(lang, 'birthday.congrats.title'))
            .setDescription(
                t(lang, 'birthday.congrats.message', {
                    users: mentions,
                    count: validIds.length,
                }),
            )
            .setColor(0xffb6c1) // розовый
            .setTimestamp();

        try {
            await channel.send({ embeds: [embed] });
            console.log(
                `[CRON] Поздравлено ${validIds.length} чел. на ${guild.name}`,
            );
        } catch (e) {
            console.error(`[CRON] Не удалось отправить в ${guild.name}:`, e);
        }
    }
}