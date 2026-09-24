const UA = 'Francesca-Bot/1.0 (https://github.com/)';

// ============ WIKIPEDIA ============
export interface WikiResult {
    title: string;
    snippet: string;
}

export async function searchWiki(
    lang: string,
    query: string,
    limit = 10,
): Promise<WikiResult[]> {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        const data: any = await res.json();
        return (data?.query?.search ?? []).map((r: any) => ({
            title: r.title,
            snippet: r.snippet?.replace(/<[^>]+>/g, '') ?? '',
        }));
    } catch {
        return [];
    }
}

export async function getWikiSummary(lang: string, title: string): Promise<any> {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// ============ GENSHIN (enka.network) ============
export interface GenshinProfile {
    uid: string;
    nickname: string;
    level: number;
    worldLevel: number;
    achievements: number;
    abyssFloor: string;
    abyssChamber: string;
    characters: number;
    signature: string;
}

export async function fetchGenshinProfile(uid: string): Promise<GenshinProfile | null> {
    try {
        const res = await fetch(`https://enka.network/api/uid/${uid}`, {
            headers: { 'User-Agent': UA },
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        const info = data?.playerInfo;
        if (!info) return null;

        const abyss = data?.playerInfo?.towerFloorIndex ?? '—';
        const chamber = data?.playerInfo?.towerLevelIndex ?? '—';

        return {
            uid: String(info.uid ?? uid),
            nickname: info.nickname ?? '—',
            level: info.level ?? 0,
            worldLevel: info.worldLevel ?? 0,
            achievements: info.finishAchievementNum ?? 0,
            abyssFloor: String(abyss),
            abyssChamber: String(chamber),
            characters: info.showAvatarInfoList?.length ?? 0,
            signature: info.signature ?? '',
        };
    } catch {
        return null;
    }
}

// ============ STEAM ============
export interface SteamProfile {
    nickname: string;
    realName?: string;
    steamId64: string;
    status: string;
    location?: string;
    memberSince?: string;
    hoursTotal?: number;
    mostPlayed: { name: string; hours: number }[];
    profileUrl: string;
    vacBanned?: boolean;
    tradeBan?: string;
}

const STEAM_STATUS: Record<number, string> = {
    0: 'offline',
    1: 'online',
    2: 'busy',
    3: 'away',
    4: 'snooze',
    5: 'looking to trade',
    6: 'looking to play',
};

export async function fetchSteamProfile(input: string): Promise<SteamProfile | null> {
    try {
        // Если это SteamID64 — используем напрямую
        // Иначе пробуем как vanity URL
        let steamId64 = input.match(/^\d{17}$/)?.[0];

        if (!steamId64) {
            // vanity URL — парсим страницу
            const res = await fetch(`https://steamcommunity.com/id/${input}/?xml=1`, {
                headers: { 'User-Agent': UA },
            });
            if (!res.ok) return null;
            const xml = await res.text();
            steamId64 = xml.match(/<steamID64>(\d+)<\/steamID64>/)?.[1];
            if (!steamId64) return null;
        }

        // Основной профиль
        const sumRes = await fetch(
            `https://steamcommunity.com/profiles/${steamId64}/?xml=1`,
            { headers: { 'User-Agent': UA } },
        );
        if (!sumRes.ok) return null;
        const xml = await sumRes.text();

        const pick = (tag: string): string | undefined => {
            const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
            return m?.[1]?.trim();
        };

        return {
            nickname: pick('steamID') ?? '—',
            realName: pick('realname'),
            steamId64,
            status: 'unknown',
            location: pick('location'),
            memberSince: pick('memberSince'),
            mostPlayed: [],
            profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
        };
    } catch {
        return null;
    }
}

// ============ YOUTUBE (scrape) ============
export interface YTChannel {
    name: string;
    url: string;
    handle?: string;
    subs?: string;
    verified?: boolean;
}

export async function searchYouTubeChannel(query: string): Promise<YTChannel[] | null> {
    try {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`;
        const res = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        if (!res.ok) return null;
        const html = await res.text();

        const match = html.match(/var ytInitialData = ({.+?});<\/script>/);
        if (!match) return null;
        const data = JSON.parse(match[1]);

        const channels: YTChannel[] = [];
        const sections =
            data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
                ?.sectionListRenderer?.contents ?? [];

        for (const section of sections) {
            const items = section?.itemSectionRenderer?.contents ?? [];
            for (const item of items) {
                const ch = item?.channelRenderer;
                if (!ch) continue;
                const name = ch.title?.simpleText;
                const handle = ch.subscriberCountText?.simpleText;
                const channelId = ch.channelId;
                const subs = ch.videoCountText?.simpleText;
                if (!name || !channelId) continue;

                channels.push({
                    name,
                    url: `https://www.youtube.com/channel/${channelId}`,
                    handle: ch.descriptionSnippet?.runs?.[0]?.text,
                    subs: handle ?? subs ?? '—',
                    verified: !!ch.ownerBadges?.some(
                        (b: any) => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED',
                    ),
                });
                if (channels.length >= 5) break;
            }
            if (channels.length >= 5) break;
        }
        return channels;
    } catch {
        return null;
    }
}