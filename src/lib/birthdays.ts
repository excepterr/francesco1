import { supabase } from './supabase';

export interface Birthday {
    guild_id: string;
    user_id: string;
    day: number;
    month: number;
    year: number | null;
    created_at?: string;
    updated_at?: string;
}

export async function getBirthday(
    guildId: string,
    userId: string,
): Promise<Birthday | null> {
    const { data, error } = await supabase
        .from('birthdays')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('[DB] getBirthday:', error.message);
        return null;
    }
    return data as Birthday | null;
}

export async function setBirthday(
    guildId: string,
    userId: string,
    day: number,
    month: number,
    year: number | null,
): Promise<boolean> {
    const { error } = await supabase
        .from('birthdays')
        .upsert(
            {
                guild_id: guildId,
                user_id: userId,
                day,
                month,
                year,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'guild_id,user_id' },
        );

    if (error) {
        console.error('[DB] setBirthday:', error.message);
        return false;
    }
    return true;
}

export async function deleteBirthday(
    guildId: string,
    userId: string,
): Promise<boolean> {
    const { error } = await supabase
        .from('birthdays')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId);

    if (error) {
        console.error('[DB] deleteBirthday:', error.message);
        return false;
    }
    return true;
}

/**
 * Возвращает ближайшие дни рождения на сервере.
 * Сортировка: сначала те, что ещё впереди (в этом году),
 * затем — уже прошедшие (в следующем году).
 */
export async function getUpcomingBirthdays(
    guildId: string,
    limit = 10,
): Promise<Birthday[]> {
    const { data, error } = await supabase
        .from('birthdays')
        .select('*')
        .eq('guild_id', guildId);

    if (error) {
        console.error('[DB] getUpcomingBirthdays:', error.message);
        return [];
    }

    const list = (data ?? []) as Birthday[];
    const now = new Date();
    const today = now.getMonth() * 100 + now.getDate(); // MM*100+DD

    // Сортируем: сначала те, у которых дата >= сегодня, потом остальные
    return list
        .map((b) => {
            const bKey = (b.month - 1) * 100 + b.day;
            const daysUntil =
                bKey >= today
                    ? bKey - today
                    : 1231 - today + bKey; // сдвиг в следующий год
            return { b, daysUntil };
        })
        .sort((a, z) => a.daysUntil - z.daysUntil)
        .slice(0, limit)
        .map((x) => x.b);
}