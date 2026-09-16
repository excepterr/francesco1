const TAVILY_URL = 'https://api.tavily.com/search';

async function tavilySearch(query, maxResults = 3) {
    try {
        const res = await fetch(TAVILY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tavily-Access-Mode': 'keyless',
            },
            body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.results?.map(r => ({ title: r.title, url: r.url, content: r.content })) ?? [];
    } catch (err) {
        console.error('tavilySearch error:', err);
        return null;
    }
}

function formatSearchResults(results) {
    if (!results?.length) return 'Ничего не найдено.';
    return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n');
}

module.exports = { tavilySearch, formatSearchResults };