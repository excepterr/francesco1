import { supabase } from './supabase';

export interface Currency {
    emoji: string;
    name: string;
}

export const DEFAULT_CURRENCY: Currency = {
    emoji: '💎',
    name: 'Валюта',
};

export async function getCurrency(guildId: string): Promise<Currency> {
    const { data } = await supabase
        .from('guild_settings')
        .select('currency_emoji, currency_name')
        .eq('guild_id', guildId)
        .maybeSingle();

    return {
        emoji: data?.currency_emoji || DEFAULT_CURRENCY.emoji,
        name: data?.currency_name || DEFAULT_CURRENCY.name,
    };
}

export async function updateCurrency(
    guildId: string,
    patch: Partial<Currency>,
): Promise<boolean> {
    const existing = await supabase
        .from('guild_settings')
        .select('guild_id')
        .eq('guild_id', guildId)
        .maybeSingle();

    if (!existing?.data) {
        await supabase.from('guild_settings').insert({
            guild_id: guildId,
            language: 'en',
            disabled_modules: [],
            birthday_enabled: false,
            birthday_channel_id: null,
            logging_enabled: false,
            logging_channel_id: null,
            logging_events: {},
            currency_emoji: patch.emoji ?? DEFAULT_CURRENCY.emoji,
            currency_name: patch.name ?? DEFAULT_CURRENCY.name,
        });
        return true;
    }

    const update: any = { updated_at: new Date().toISOString() };
    if (patch.emoji !== undefined) update.currency_emoji = patch.emoji;
    if (patch.name !== undefined) update.currency_name = patch.name;

    const { error } = await supabase
        .from('guild_settings')
        .update(update)
        .eq('guild_id', guildId);

    if (error) {
        console.error('[DB] updateCurrency:', error.message);
        return false;
    }
    return true;
}