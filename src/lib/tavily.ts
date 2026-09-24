const TAVILY_API = 'https://api.tavily.com/search';

export interface TavilyResult {
    title: string;
    url: string;
    content: string;
}

export async function tavilySearch(query: string, maxResults = 3): Promise<TavilyResult[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        console.error('[TAVILY] TAVILY_API_KEY не задан в .env');
        return [];
    }

    try {
        const res = await fetch(TAVILY_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                max_results: maxResults,
                search_depth: 'basic',
            }),
        });
        if (!res.ok) {
            console.error('[TAVILY] HTTP', res.status);
            return [];
        }
        const data: any = await res.json();
        return (data.results ?? []).map((r: any) => ({
            title: r.title ?? '',
            url: r.url ?? '',
            content: r.content ?? '',
        }));
    } catch (e) {
        console.error('[TAVILY] Ошибка:', e);
        return [];
    }
}

export function formatSearchResults(results: TavilyResult[]): string {
    if (!results.length) return 'Ничего не найдено.';
    return results
        .map(
            (r, i) =>
                `[${i + 1}] ${r.title}\n${r.url}\n${r.content.slice(0, 500)}`,
        )
        .join('\n\n---\n\n');
}