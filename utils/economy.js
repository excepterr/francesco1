const supabase = require('./supabase');

// ───────────────────────────────────────────
// КОНСТАНТЫ
// ───────────────────────────────────────────
const BASE_TAX = 0.28;
const EMPLOYMENT_TAX = 0.06;
const TAX_GROWTH_PER_TX = 0.002;
const TAX_MAX = 0.60;

const EMPLOYMENT = {
    daily:  { usd: 6, cooldown: 24 * 60 * 60 * 1000 },
    timely: { usd: 2, cooldown: 12 * 60 * 60 * 1000 },
};

// ───────────────────────────────────────────
// ФИАТ
// ───────────────────────────────────────────
async function getBaseCurrencies() {
    const { data } = await supabase.from('currencies').select('*').order('code');
    return (data ?? []).map(c => ({
        ...c,
        rate_usd: parseFloat(c.rate_usd),
        base_rate: parseFloat(c.base_rate),
    }));
}

async function getServerCurrency(guildId) {
    const { data } = await supabase
        .from('server_currencies').select('*')
        .eq('guild_id', guildId).maybeSingle();
    if (!data) return null;
    return {
        ...data,
        rate_usd: parseFloat(data.rate_usd),
        base_rate: parseFloat(data.base_rate),
    };
}

// ───────────────────────────────────────────
// КРИПТА
// ───────────────────────────────────────────
async function getCryptoCurrencies() {
    const { data } = await supabase
        .from('crypto_currencies')
        .select('*')
        .order('rate_usd', { ascending: false });
    return (data ?? []).map(c => ({
        ...c,
        rate_usd: parseFloat(c.rate_usd),
        base_rate: parseFloat(c.base_rate),
    }));
}

async function getCryptoByCode(code) {
    const { data } = await supabase
        .from('crypto_currencies')
        .select('*')
        .eq('code', code)
        .maybeSingle();
    if (!data) return null;
    return {
        ...data,
        rate_usd: parseFloat(data.rate_usd),
        base_rate: parseFloat(data.base_rate),
    };
}

async function addCrypto({ code, name, symbol, emoji, rateUsd, createdBy }) {
    // код занят криптой?
    const { data: existing } = await supabase
        .from('crypto_currencies')
        .select('code')
        .eq('code', code)
        .maybeSingle();
    if (existing) return { ok: false, reason: 'exists' };

    // код занят фиатом?
    const { data: fiat } = await supabase
        .from('currencies').select('code').eq('code', code).maybeSingle();
    if (fiat) return { ok: false, reason: 'reserved' };

    const { error } = await supabase.from('crypto_currencies').insert({
        code,
        name,
        symbol,
        emoji,
        rate_usd: rateUsd,
        base_rate: rateUsd,
        created_by: createdBy,
    });
    if (error) {
        console.error('addCrypto error:', error);
        return { ok: false, reason: 'db_error' };
    }
    return { ok: true };
}

async function removeCrypto(code) {
    const { error } = await supabase
        .from('crypto_currencies')
        .delete()
        .eq('code', code);
    if (error) return { ok: false, reason: 'db_error' };
    return { ok: true };
}

/** % изменение цены за последние 24 часа */
async function getCryptoChange24h(code) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
        .from('crypto_history')
        .select('rate_usd, recorded_at')
        .eq('code', code)
        .gte('recorded_at', dayAgo)
        .order('recorded_at', { ascending: true })
        .limit(1);

    const old = data?.[0]?.rate_usd ? parseFloat(data[0].rate_usd) : null;
    const cur = await getCryptoByCode(code);
    if (!old || !cur) return null;
    return ((cur.rate_usd - old) / old) * 100;
}

/** Снепшот всех курсов крипты (для расчёта 24h изменений) */
async function recordCryptoSnapshot() {
    const list = await getCryptoCurrencies();
    if (!list.length) return;
    const rows = list.map(c => ({ code: c.code, rate_usd: c.rate_usd }));
    await supabase.from('crypto_history').insert(rows);
}

// ───────────────────────────────────────────
// КУРСЫ (универсальный)
// ───────────────────────────────────────────
async function getRate(code, guildId) {
    if (code === 'USD') return 1.0;

    // фиат
    const { data: base } = await supabase
        .from('currencies').select('rate_usd').eq('code', code).maybeSingle();
    if (base) return parseFloat(base.rate_usd);

    // крипта
    const crypto = await getCryptoByCode(code);
    if (crypto) return crypto.rate_usd;

    // серверная
    const srv = await getServerCurrency(guildId);
    if (srv && srv.code === code) return srv.rate_usd;

    return null;
}

async function convert(amount, fromCode, toCode, guildId) {
    if (fromCode === toCode) return amount;
    const rFrom = await getRate(fromCode, guildId);
    const rTo = await getRate(toCode, guildId);
    if (rFrom == null || rTo == null) return null;
    return amount * (rFrom / rTo);
}

async function usdTo(code, usdAmount, guildId) {
    const r = await getRate(code, guildId);
    if (r == null) return null;
    return usdAmount / r;
}

async function toUsd(code, amount, guildId) {
    const r = await getRate(code, guildId);
    if (r == null) return null;
    return amount * r;
}

/**
 * Random walk + mean reversion для фиата, крипты и серверных валют.
 * Вызывается таймером раз в 5 минут.
 */
async function fluctuateRates() {
    // ── ФИАТ (±0.25%) ──
    const { data: bases } = await supabase.from('currencies').select('*');
    for (const c of bases ?? []) {
        const old = parseFloat(c.rate_usd);
        const anchor = parseFloat(c.base_rate);
        const drift = (Math.random() - 0.5) * 0.005;
        const revert = (anchor - old) * 0.05;
        let next = old * (1 + drift) + revert;
        next = Math.max(anchor * 0.5, Math.min(anchor * 2.0, next));
        await supabase.from('currencies')
            .update({ rate_usd: next, updated_at: new Date().toISOString() })
            .eq('code', c.code);
    }

    // ── СЕРВЕРНЫЕ (±0.25%) ──
    const { data: servers } = await supabase.from('server_currencies').select('*');
    for (const c of servers ?? []) {
        const old = parseFloat(c.rate_usd);
        const anchor = parseFloat(c.base_rate);
        const drift = (Math.random() - 0.5) * 0.005;
        const revert = (anchor - old) * 0.05;
        let next = old * (1 + drift) + revert;
        next = Math.max(anchor * 0.5, Math.min(anchor * 2.0, next));
        await supabase.from('server_currencies')
            .update({ rate_usd: next })
            .eq('guild_id', c.guild_id);
    }

    // ── КРИПТА (±2%, слабая тяга) ──
    const { data: cryptos } = await supabase.from('crypto_currencies').select('*');
    for (const c of cryptos ?? []) {
        const old = parseFloat(c.rate_usd);
        const anchor = parseFloat(c.base_rate);
        const drift = (Math.random() - 0.5) * 0.04;
        const revert = (anchor - old) * 0.02;
        let next = old * (1 + drift) + revert;
        next = Math.max(anchor * 0.05, Math.min(anchor * 20.0, next));
        await supabase.from('crypto_currencies')
            .update({ rate_usd: next, updated_at: new Date().toISOString() })
            .eq('code', c.code);
    }

    // ── Снепшот для 24h динамики ──
    await recordCryptoSnapshot();
}

// ───────────────────────────────────────────
// ПРЕДПОЧТЕНИЯ ЮЗЕРА
// ───────────────────────────────────────────
async function getPreferredCurrency(userId, guildId) {
    const { data } = await supabase
        .from('user_preferences').select('currency_code')
        .eq('user_id', userId).eq('guild_id', guildId).maybeSingle();
    return data?.currency_code ?? 'USD';
}

async function setPreferredCurrency(userId, guildId, code) {
    await supabase.from('user_preferences').upsert({
        user_id: userId,
        guild_id: guildId,
        currency_code: code,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,guild_id' });
    return code;
}

// ───────────────────────────────────────────
// БАЛАНС (единый, в USD)
// ───────────────────────────────────────────
async function getBalanceUSD(userId, guildId) {
    const { data } = await supabase
        .from('wallets').select('amount_usd')
        .eq('user_id', userId).eq('guild_id', guildId).maybeSingle();
    return data ? parseFloat(data.amount_usd) : 0;
}

async function getDisplayBalance(userId, guildId, code = null) {
    const usd = await getBalanceUSD(userId, guildId);
    const target = code ?? await getPreferredCurrency(userId, guildId);
    const rate = await getRate(target, guildId);
    if (rate == null) return { amount: usd, code: 'USD', amountUSD: usd };
    return { amount: usd / rate, code: target, amountUSD: usd };
}

async function addBalanceUSD(userId, guildId, usdAmount) {
    const current = await getBalanceUSD(userId, guildId);
    const next = current + usdAmount;
    await supabase.from('wallets').upsert({
        user_id: userId,
        guild_id: guildId,
        amount_usd: next,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,guild_id' });
    return next;
}

async function addBalance(userId, guildId, code, amount) {
    const usd = await toUsd(code, amount, guildId);
    if (usd == null) throw new Error('unknown_currency');
    return addBalanceUSD(userId, guildId, usd);
}

async function subBalance(userId, guildId, code, amount) {
    return addBalance(userId, guildId, code, -amount);
}

// ───────────────────────────────────────────
// НАЛОГИ
// ───────────────────────────────────────────
async function getTaxRate(userId, guildId) {
    const { data } = await supabase.from('tax_rates').select('rate')
        .eq('user_id', userId).eq('guild_id', guildId).maybeSingle();
    return data ? parseFloat(data.rate) : BASE_TAX;
}

async function bumpTaxRate(userId, guildId) {
    const { data } = await supabase.from('tax_rates').select('rate, tx_count')
        .eq('user_id', userId).eq('guild_id', guildId).maybeSingle();
    const tx = (data?.tx_count ?? 0) + 1;
    let rate = (data?.rate ? parseFloat(data.rate) : BASE_TAX) + TAX_GROWTH_PER_TX;
    rate = Math.min(TAX_MAX, rate);
    await supabase.from('tax_rates').upsert({
        user_id: userId,
        guild_id: guildId,
        rate,
        tx_count: tx,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,guild_id' });
    return rate;
}

// ───────────────────────────────────────────
// ТРАНЗАКЦИИ
// ───────────────────────────────────────────
async function createTransaction(opts) {
    const {
        userId, guildId, type, currency, amount,
        taxRate = 0, meta = {}, logFn = null,
    } = opts;

    const taxAmount = amount * taxRate;
    const netAmount = amount - taxAmount;
    const amountUSD = await toUsd(currency, amount, guildId);

    const { data, error } = await supabase.from('transactions').insert({
        user_id: userId,
        guild_id: guildId,
        type,
        currency_code: currency,
        amount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        net_amount: netAmount,
        meta: { ...meta, amount_usd: amountUSD },
    }).select('token').single();

    if (error) {
        console.error('createTransaction error:', error);
        return null;
    }

    if (logFn) {
        try {
            await logFn(data.token, {
                userId, guildId, type, currency,
                amount, taxRate, taxAmount, netAmount, amountUSD, meta,
            });
        } catch (e) {
            console.error('tx log error:', e);
        }
    }
    return data.token;
}

async function getTransaction(token) {
    const { data } = await supabase
        .from('transactions').select('*').eq('token', token).maybeSingle();
    return data;
}

async function blockTransaction(token, blockedBy, reason = null) {
    const { data, error } = await supabase.from('transactions')
        .update({
            blocked: true,
            blocked_by: blockedBy,
            blocked_at: new Date().toISOString(),
            block_reason: reason,
        })
        .eq('token', token)
        .select('*')
        .maybeSingle();
    if (error || !data) return null;
    return data;
}

// ───────────────────────────────────────────
// EMPLOYMENT
// ───────────────────────────────────────────
async function claimEmployment(userId, guildId, type) {
    const cfg = EMPLOYMENT[type];
    if (!cfg) return { ok: false, reason: 'unknown_type' };

    const { data: existing } = await supabase.from('employment').select('last_used')
        .eq('user_id', userId).eq('guild_id', guildId).eq('type', type).maybeSingle();

    const now = Date.now();
    if (existing) {
        const last = new Date(existing.last_used).getTime();
        const diff = now - last;
        if (diff < cfg.cooldown) {
            return { ok: false, reason: 'cooldown', remaining: cfg.cooldown - diff };
        }
    }

    await supabase.from('employment').upsert({
        user_id: userId,
        guild_id: guildId,
        type,
        last_used: new Date().toISOString(),
    }, { onConflict: 'user_id,guild_id,type' });

    return { ok: true, amount: cfg.usd };
}

// ───────────────────────────────────────────
// СЕРВЕРНАЯ ВАЛЮТА
// ───────────────────────────────────────────
async function createServerCurrency(guildId, code, name, symbol, baseRateUsd) {
    const { data: base } = await supabase
        .from('currencies').select('code').eq('code', code).maybeSingle();
    if (base) return { ok: false, reason: 'reserved' };

    const { data: crypto } = await supabase
        .from('crypto_currencies').select('code').eq('code', code).maybeSingle();
    if (crypto) return { ok: false, reason: 'reserved' };

    const existing = await getServerCurrency(guildId);
    if (existing) return { ok: false, reason: 'already_exists' };

    const { error } = await supabase.from('server_currencies').insert({
        guild_id: guildId,
        code,
        name,
        symbol,
        rate_usd: baseRateUsd,
        base_rate: baseRateUsd,
    });
    if (error) return { ok: false, reason: 'db_error', error };
    return { ok: true };
}

// ───────────────────────────────────────────
// ФОРМАТИРОВАНИЕ
// ───────────────────────────────────────────
function formatMoney(amount, code, guildCurrencySymbol = null) {
    const symbols = {
        USD: '$', EUR: '€', JPY: '¥', GBP: '£',
        CNY: '¥', CHF: 'Fr', RUB: '₽', CAD: 'C$',
        BTC: '₿', ETH: 'Ξ', SOL: '◎', DOGE: 'Ð', ADA: '₳',
    };
    const sym = symbols[code] ?? guildCurrencySymbol ?? code;
    const num = Number(amount).toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
    return `${num} ${sym}`;
}

function formatRate(rate) {
    if (rate >= 1000) return rate.toFixed(2);
    if (rate >= 100)  return rate.toFixed(4);
    if (rate >= 1)    return rate.toFixed(6);
    return rate.toFixed(8);
}

module.exports = {
    // константы
    BASE_TAX,
    EMPLOYMENT_TAX,
    TAX_MAX,
    EMPLOYMENT,

    // фиат
    getBaseCurrencies,
    getServerCurrency,

    // крипта
    getCryptoCurrencies,
    getCryptoByCode,
    addCrypto,
    removeCrypto,
    getCryptoChange24h,
    recordCryptoSnapshot,

    // курсы
    getRate,
    convert,
    usdTo,
    toUsd,
    fluctuateRates,

    // предпочтения
    getPreferredCurrency,
    setPreferredCurrency,

    // баланс
    getBalanceUSD,
    getDisplayBalance,
    addBalanceUSD,
    addBalance,
    subBalance,

    // налоги
    getTaxRate,
    bumpTaxRate,

    // транзакции
    createTransaction,
    getTransaction,
    blockTransaction,

    // employment
    claimEmployment,

    // серверная валюта
    createServerCurrency,

    // формат
    formatMoney,
    formatRate,
};