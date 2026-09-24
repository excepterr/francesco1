import { supabase } from './supabase';

export interface EconomyUser {
    guild_id: string;
    user_id: string;
    wallet: number;
    bank: number;
    hellcoin: number;
    level: number;
    xp: number;
    last_timely: number;
    last_daily: number;
    last_weekly: number;
    last_work: number;
    marry_partner: string | null;
    marry_date: number | null;
}

export const COOLDOWNS = {
    timely: 3 * 3600 * 1000,
    daily: 24 * 3600 * 1000,
    weekly: 7 * 24 * 3600 * 1000,
    work: 3600 * 1000,
};

export const REWARDS = {
    timely: 50,
    daily: 100,
    weekly: 500,
};

export const xpForLevel = (level: number) => level * 40;

export const WORK_JOBS = [
    'Подручный беса',
    'Сборщик душ',
    'Торговец грехами',
    'Курьер ада',
    'Инквизитор-стажёр',
    'Костоправ',
    'Служитель алтаря',
    'Ночной страж',
    'Алхимик',
    'Жрец тьмы',
];

export const MAX_LEVEL = 100;

export async function getUser(guildId: string, userId: string): Promise<EconomyUser> {
    const { data } = await supabase
        .from('economy_users')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .maybeSingle();

    if (data) return data as EconomyUser;

    const defaults: EconomyUser = {
        guild_id: guildId,
        user_id: userId,
        wallet: 0,
        bank: 0,
        hellcoin: 0,
        level: 1,
        xp: 0,
        last_timely: 0,
        last_daily: 0,
        last_weekly: 0,
        last_work: 0,
        marry_partner: null,
        marry_date: null,
    };

    await supabase.from('economy_users').insert(defaults);
    return defaults;
}

export async function updateUser(
    guildId: string,
    userId: string,
    patch: Partial<EconomyUser>,
): Promise<boolean> {
    await getUser(guildId, userId);
    const { error } = await supabase
        .from('economy_users')
        .update(patch)
        .eq('guild_id', guildId)
        .eq('user_id', userId);
    if (error) {
        console.error('[DB] updateUser:', error.message);
        return false;
    }
    return true;
}

export async function addMoney(
    guildId: string,
    userId: string,
    amount: number,
    to: 'wallet' | 'bank' = 'wallet',
): Promise<boolean> {
    const u = await getUser(guildId, userId);
    const newVal = Math.max(0, u[to] + amount);
    return updateUser(guildId, userId, { [to]: newVal });
}

export async function getLeaderboard(
    guildId: string,
    page: number,
    pageSize = 10,
): Promise<{ users: EconomyUser[]; total: number }> {
    const { data } = await supabase
        .from('economy_users')
        .select('*')
        .eq('guild_id', guildId);

    const all = ((data ?? []) as EconomyUser[])
        .map((u) => ({ ...u, _total: u.wallet + u.bank }))
        .sort((a, b) => b._total - a._total);

    const from = page * pageSize;
    return {
        users: all.slice(from, from + pageSize),
        total: all.length,
    };
}

export async function getUserRank(
    guildId: string,
    userId: string,
): Promise<number> {
    const { data } = await supabase
        .from('economy_users')
        .select('user_id, wallet, bank')
        .eq('guild_id', guildId);

    const all = (data ?? [])
        .map((u: any) => ({ id: u.user_id, total: (u.wallet ?? 0) + (u.bank ?? 0) }))
        .sort((a, b) => b.total - a.total);

    const idx = all.findIndex((u) => u.id === userId);
    return idx === -1 ? 0 : idx + 1;
}

// ===== Shop =====
export interface ShopRole {
    id: number;
    guild_id: string;
    role_id: string;
    price: number;
    position: number;
}

export async function getShopRoles(guildId: string): Promise<ShopRole[]> {
    const { data } = await supabase
        .from('economy_shop_roles')
        .select('*')
        .eq('guild_id', guildId)
        .order('position', { ascending: true })
        .order('price', { ascending: true });
    return (data ?? []) as ShopRole[];
}

export async function addShopRole(
    guildId: string,
    roleId: string,
    price: number,
): Promise<boolean> {
    const { error } = await supabase
        .from('economy_shop_roles')
        .upsert(
            { guild_id: guildId, role_id: roleId, price },
            { onConflict: 'guild_id,role_id' },
        );
    if (error) {
        console.error('[DB] addShopRole:', error.message);
        return false;
    }
    return true;
}

export async function removeShopRole(guildId: string, roleId: string): Promise<boolean> {
    const { error } = await supabase
        .from('economy_shop_roles')
        .delete()
        .eq('guild_id', guildId)
        .eq('role_id', roleId);
    if (error) {
        console.error('[DB] removeShopRole:', error.message);
        return false;
    }
    return true;
}

export async function hasPurchased(
    guildId: string,
    userId: string,
    roleId: string,
): Promise<boolean> {
    const { data } = await supabase
        .from('economy_purchases')
        .select('id')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .maybeSingle();
    return !!data;
}

export async function addPurchase(
    guildId: string,
    userId: string,
    roleId: string,
): Promise<boolean> {
    const { error } = await supabase.from('economy_purchases').insert({
        guild_id: guildId,
        user_id: userId,
        role_id: roleId,
        purchased_at: Date.now(),
    });
    if (error) {
        console.error('[DB] addPurchase:', error.message);
        return false;
    }
    return true;
}

/** Форматирование чисел с пробелами */
export function fmt(n: number): string {
    return n.toLocaleString('ru-RU');
}