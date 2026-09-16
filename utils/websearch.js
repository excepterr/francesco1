const TIMEOUT = 8000;

// ─── Wikipedia ───
async function searchWiki(lang, query, limit = 5) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json&origin=*`;
    const data = await fetchJson(url);
    if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
    return data[1].map((title, i) => ({
        title,
        url: data[3]?.[i] ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    }));
}

async function getWikiSummary(lang, title) {
    return fetchJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
}

// ─── Genshin — Enka.Network (бесплатно, без ключа) ───
async function fetchGenshinProfile(uid) {
    const url = `https://enka.network/api/uid/${encodeURIComponent(uid)}`;
    const data = await fetchJson(url);
    if (!data || data.error) return null;

    // Enka возвращает { playerInfo, avatarInfoList, ttl }
    const info = data.playerInfo ?? {};
    const avatars = (data.avatarInfoList ?? []).slice(0, 8);

    return {
        uid,
        nickname: info.nickname ?? '—',
        level: info.level ?? '—',
        worldLevel: info.worldLevel ?? '—',
        signature: info.signature ?? '',
        achievements: info.finishAchievementNum ?? '—',
        abyssFloor: info.towerFloorIndex ?? '—',
        abyssChamber: info.towerLevelIndex ?? '—',
        characters: avatars.length,
        raw: data,
    };
}

// ─── Steam — публичный XML (без ключа) ───
async function fetchSteamProfile(idOrVanity) {
    // если число — profiles/, иначе id/
    const isNumeric = /^\d{17}$/.test(idOrVanity);
    const path = isNumeric
        ? `https://steamcommunity.com/profiles/${idOrVanity}/?xml=1`
        : `https://steamcommunity.com/id/${encodeURIComponent(idOrVanity)}/?xml=1`;

    const xml = await fetchText(path);
    if (!xml || xml.includes('<error>')) return null;

    const get = (tag) => {
        const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
        return m ? m[1].trim() : null;
    };
    const getAll = (tag) => {
        const out = [];
        const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'g');
        let m;
        while ((m = re.exec(xml))) out.push(m[1].trim());
        return out;
    };

    const stateMap = {
        0: 'Offline',
        1: 'Online',
        2: 'Busy',
        3: 'Away',
        4: 'Snooze',
        5: 'Looking to trade',
        6: 'Looking to play',
    };
    const stateCode = parseInt(get('stateMessage') ? '0' : '0'); // fallback

    return {
        steamId64: get('steamID64') ?? idOrVanity,
        nickname: get('steamID') ?? idOrVanity,
        realName: get('realname') ?? null,
        avatar: get('avatarFull') ?? get('avatarMedium'),
        status: stateMap[get('onlineState')] ?? get('onlineState') ?? '—',
        stateMessage: get('stateMessage'),
        summary: get('summary'),
        location: get('location'),
        memberSince: get('memberSince'),
        hoursTotal: get('hoursPlayed2Wk'),
        mostPlayed: (() => {
            const names = getAll('name');
            const hours = getAll('hoursOnRecord');
            return names.slice(0, 3).map((n, i) => ({ name: n, hours: hours[i] ?? '—' }));
        })(),
        vacBanned: get('vacBanned') === '1',
        tradeBan: get('tradeBanState') ?? null,
        friends: get('friends'),
        profileUrl: get('steamID64') && isNumeric
            ? path.replace('?xml=1', '')
            : path.replace('?xml=1', ''),
    };
}

// ─── YouTube — поиск каналов (ytube-noapi, без ключа) ───
async function searchYouTubeChannel(query) {
    let YTubeNoAPI;
    try {
        YTubeNoAPI = require('ytube-noapi').YTubeNoAPI;
    } catch {
        return null;
    }
    try {
        const yt = new YTubeNoAPI();
        const channels = await yt.searchChannels(query, 3);
        return channels.map(c => ({
            id: c.channelId ?? c.id,
            name: c.name ?? c.title ?? '—',
            handle: c.handle ?? c.channelHandle ?? null,
            subs: c.subscriberCountText ?? c.subscriberCount ?? '—',
            verified: !!c.verified,
            avatar: c.thumbnail ?? c.avatar ?? null,
            url: `https://youtube.com/channel/${c.channelId ?? c.id}`,
        }));
    } catch (err) {
        console.error('YouTube channel search error:', err.message);
        return null;
    }
}

// ─── helpers ───
async function fetchJson(url) {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), TIMEOUT);
    try {
        const res = await fetch(url, {
            signal: c.signal,
            headers: { 'User-Agent': 'DiscordBot/1.0 (websearch)' },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
    finally { clearTimeout(timer); }
}

async function fetchText(url) {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), TIMEOUT);
    try {
        const res = await fetch(url, {
            signal: c.signal,
            headers: { 'User-Agent': 'DiscordBot/1.0 (websearch)' },
        });
        if (!res.ok) return null;
        return await res.text();
    } catch { return null; }
    finally { clearTimeout(timer); }
}

module.exports = {
    searchWiki,
    getWikiSummary,
    fetchGenshinProfile,
    fetchSteamProfile,
    searchYouTubeChannel,
};