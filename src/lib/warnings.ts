import { supabase } from './supabase';

export interface Warning {
    id: number;
    guild_id: string;
    user_id: string;
    moderator_id: string;
    reason: string | null;
    created_at: number;
}

export async function addWarning(
    guildId: string,
    userId: string,
    moderatorId: string,
    reason: string | null,
): Promise<Warning | null> {
    const { data, error } = await supabase
        .from('warnings')
        .insert({
            guild_id: guildId,
            user_id: userId,
            moderator_id: moderatorId,
            reason,
            created_at: Date.now(),
        })
        .select('*')
        .single();

    if (error) {
        console.error('[DB] addWarning:', error.message);
        return null;
    }
    return data as Warning;
}

export async function listWarnings(
    guildId: string,
    userId: string,
): Promise<Warning[]> {
    const { data, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB] listWarnings:', error.message);
        return [];
    }
    return (data ?? []) as Warning[];
}

export async function removeWarning(
    guildId: string,
    warningId: number,
): Promise<boolean> {
    const { error } = await supabase
        .from('warnings')
        .delete()
        .eq('guild_id', guildId)
        .eq('id', warningId);

    if (error) {
        console.error('[DB] removeWarning:', error.message);
        return false;
    }
    return true;
}

export async function clearWarnings(
    guildId: string,
    userId: string,
): Promise<boolean> {
    const { error } = await supabase
        .from('warnings')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId);

    if (error) {
        console.error('[DB] clearWarnings:', error.message);
        return false;
    }
    return true;
}