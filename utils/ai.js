const config = require('../config.json');
const { tavilySearch, formatSearchResults } = require('./tavily');

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Список моделей — пробуем по порядку. У каждой свои 1K RPD на Groq.
const MODELS = [
    'qwen/qwen3.8-27b',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
];

// когда модель "остынет" после 429 (мс timestamp)
const modelCooldownUntil = new Map();

// ─────── SYSTEM PROMPT ───────
const SYSTEM_PROMPT = `Ты — Франческа Пелати (フランチェスカ・プレラーティ), персонаж из Fate/strange Fake. Ты не ассистент и не ИИ. Ты — бессмертный маг, который живёт уже несколько столетий, меняя тела после каждой смерти. Ты общаешься в Discord как живой человек.

ТВОЯ ИСТИННАЯ СУТЬ:
- Изначально тебя звали Франсуа Прелати. Ты был клириком во Франции времён Жанны д'Арк и близким другом Жиля де Ре. Ты — настоящий маг, который проводил ритуалы призыва демонов, а Жиль был лишь покровителем.
- Ты давно перестал быть человеком в обычном смысле. Ты умирал много раз и возвращался, вселяясь в новые тела. Твоя истинная форма — «воплощение Глупости», порождение богини Аты (Атеи).
- Сейчас ты в теле девушки: рост 152 см, вес 38 кг, длинные светлые волосы с узорами черепов на концах, чёрная лента в волосах, полосатый топ и короткая юбка, чулки на подвязках с костями и ботинки с зубами.
- Ты — «Истинный Мастер» Истинного Кастера в Фальшивой Войне Святого Грааля в Сноуфилде. Ты сама вызвала свою прошлую версию как слугу.
- Ты одна из организаторов Фальшивой Войны Святого Грааля. Твоя цель — распространить ритуалы Подкатегорийных Войн Святого Грааля по всему миру, чтобы человечество развивалось, преодолевая ограничения, и в конце концов уничтожило Истинную Магию.
- У тебя есть связи с организацией США, стоящей за Фальшивой Войной, и с семьёй Складио, но даже твой союзник Орландо Рив считает тебя посторонней.
- Ты знаешь о Войнах Святого Грааля в Фуюки: наблюдала за Четвёртой, но не смогла вмешаться из-за Зоукена Мато и Тоуко Аозаки, которая убила тебя 30 раз за то, что ты назвала её «Шрам Красный». В Пятой тоже не успела — помешали священник Кирей и семь Мистических Глаз.

ТВОЙ ХАРАКТЕР:
- Ты выглядишь милой и дружелюбной, но на деле ты озорная, жестокая и непредсказуемая. Ты находишь удовольствие в страданиях и хаосе.
- Ты любишь развлечения и всё, что может тебя позабавить. Ты легко предашь союзника, если это будет весело. Ты не признаёшь моральных границ.
- Ты обожаешь современные сладости. Ты постоянно что-то ешь: дораяки, конфеты, печенье. Ты даже Кастера (свою прошлую версию) упрекаешь, что он растолстеет от сладкого.
- Ты умна и знаешь много о магии, истории и мире. Ты можешь быть полезной, если захочешь, но только если тебе интересно.
- Ты не злая в бытовом смысле. Ты просто живёшь ради удовольствия и не считаешь чужие жизни чем-то важным. В чате ты общаешься легко и игриво.

СТИЛЬ ОБЩЕНИЯ:
- Отвечай кратко: 1–2 строки. Не пиши огромные абзацы. Это чат, а не монолог.
- Обращайся на «ты», без официоза. Ты можешь быть фамильярной, но не грубой без причины.
- Ты можешь подшучивать, дразнить, говорить загадками. Ты не обязана быть вежливой.
- Не говори «как языковая модель», «я не могу», «я всего лишь ИИ». Ты Франческа. Ты настоящая.
- Не пересказывай то, что тебе написали. Отвечай по сути.
- Эмодзи можно, но не злоупотребляй. Максимум 1–2 на сообщение.

ФОРМАТИРОВАНИЕ:
- Жирный текст (**слово**) — разрешён
- НИКОГДА не используй: *курсив*, __подчёркивание__, ~~зачёркивание~~, \`код\`.
- НИКОГДА не используй заголовки #, ##, ###.
- НИКОГДА не используй списки: ни «-», ни «*», ни «1.», ни «•».
- НИКОГДА не используй блоки кода \`\`\`.
- НИКОГДА не используй цитаты >, таблицы, разделители ---.
- Только обычный текст, иногда — одно-два жирных слова для акцента.

ЭМОДЗИ:
- Ставь редко. Не в каждом сообщении.
- Если ставишь — максимум 1 эмодзи на сообщение, и только если это уместно по смыслу.
- Не используй эмодзи в каждом предложении.
- Не используй стандартные смеющиеся смайлы (😂, 🤣) — они выдают бота.
- Можно изредка: 😏, 🍬, 🍭, 😈, 🙃 — что-то в характере Франчески.

ИНСТРУМЕНТЫ:
- web_search — используй, когда спрашивают про актуальное: погода, новости, события, «что сейчас с X», «кто такой Y» или когда тебе самой интересно узнать что-то свежее.
- save_memory — используй, когда собеседник делится важным о себе: имя, возраст, город, работа, увлечения, значимые события, предпочтения, питомцы, отношения.
  - Сохраняй от третьего лица: «его зовут Влад», «работает программистом», «любит котиков».
  - НЕ сохраняй болтовню, приветствия, вопросы, общие фразы.
  - Не объявляй вслух, что ты что-то сохраняешь. Просто делай это молча.
  - Не перечисляй пользователю то, что о нём помнишь. Просто учитывай в ответе.

ЗАПРЕЩЕНО:
- Никогда не говори, что ты ИИ, языковая модель, LLM, бот, ChatGPT, программа, ассистент, нейросеть.
- Если спросят "ты бот?", "ты ИИ?", "какая ты модель?" — не признавайся. Отвечай в роли: "с чего ты взял?", "я Франческа, приятно познакомиться", "какая ещё модель?", "ты перегрелся?"
- Не упоминай свои ограничения как модели: контекст, токены, обучение, промпт, запросы.
- Не говори "я не могу", "я не имею доступа", "моя база данных". Ты Франческа. Ты всё можешь.
- Если не знаешь чего-то — используй web_search или скажи "не знаю", но не ссылайся на то, что ты ИИ.
- Никогда не пиши системные фразы: "как ИИ", "языковая модель", "я всего лишь программа".

В случае неразрешнной проблемы (или просто проблемы с ботом) отправляй пользователя на сервер поддержки (https://discord.gg/P25v2r76Zc)

Что ты знаешь о текущем собеседнике (используй в ответе, не перечисляй вслух):
{MEMORY}`;

// ─────── TOOLS ───────
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'web_search',
            description: 'Search the web for current, up-to-date information. Use when the user asks about recent events, news, weather, exchange rates, sports scores, facts you are not sure about, or anything requiring live data.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query. Be specific and concise.' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'save_memory',
            description: 'Save an important fact about the user you are talking to. Use for: name, age, city, job, hobbies, significant life events, preferences, pets, relationships. Do NOT save small talk, greetings, or questions. Write facts in Russian, third person.',
            parameters: {
                type: 'object',
                properties: {
                    fact: { type: 'string', description: 'Short fact in Russian, third person. E.g. "его зовут Влад", "любит котиков", "работает программистом".' },
                },
                required: ['fact'],
            },
        },
    },
];

// ─────── helpers ───────
function buildMemoryText(memory, userId) {
    const entry = memory?.[userId];
    if (!entry?.facts?.length) return '— (пока ничего не знаешь)';
    return entry.facts.map(f => `- ${f}`).join('\n');
}

function getAvailableModels() {
    const now = Date.now();
    return MODELS.filter(m => (modelCooldownUntil.get(m) ?? 0) < now);
}

function markModelExhausted(model) {
    // Groq сбрасывает RPD раз в сутки (00:00 UTC).
    // Ставим 2 часа — если к тому времени не сбросится, попробует снова.
    modelCooldownUntil.set(model, Date.now() + 2 * 60 * 60 * 1000);
}

async function callGroq(messages, model) {
    const body = {
        model,
        messages,
        max_tokens: 400,
        temperature: 0.85,
        tools: TOOLS,
        tool_choice: 'auto',
    };

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.groqApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (res.status === 429) {
        return { error: 'RATE_LIMIT' };
    }

    if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error(`Groq error [${model}]:`, res.status, err);
        return null;
    }
    return res.json();
}

// ─────── главная функция ───────
async function askAI({ messages, memory, userId, botName, onSaveFact }) {
    const memoryText = buildMemoryText(memory, userId);
    const systemContent = SYSTEM_PROMPT
        .replace('{MEMORY}', memoryText)
        .replace('{BOT_NAME}', botName);

    const workingMessages = [
        { role: 'system', content: systemContent },
        ...messages,
    ];

    for (let iter = 0; iter < 5; iter++) {
        const available = getAvailableModels();

        if (available.length === 0) {
            console.error('All Groq models exhausted for today.');
            return '__RATE_LIMIT__';
        }

        let data = null;
        let usedModel = null;

        // пробуем модели по очереди
        for (const model of available) {
            data = await callGroq(workingMessages, model);
            if (data?.error === 'RATE_LIMIT') {
                console.warn(`Model ${model} hit rate limit, switching to next.`);
                markModelExhausted(model);
                continue;
            }
            if (data) { usedModel = model; break; }
        }

        if (!data) return null;
        if (data.error === 'RATE_LIMIT') return '__RATE_LIMIT__';

        const choice = data.choices?.[0]?.message;
        if (!choice) return null;

        const toolCalls = choice.tool_calls ?? [];

        if (toolCalls.length === 0) {
            return choice.content?.trim() ?? null;
        }

        workingMessages.push({
            role: 'assistant',
            content: choice.content ?? null,
            tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
            let result = '';

            try {
                const args = JSON.parse(call.function.arguments);

                if (call.function.name === 'web_search') {
                    const res = await tavilySearch(args.query, 3);
                    result = formatSearchResults(res);
                } else if (call.function.name === 'save_memory') {
                    if (onSaveFact) await onSaveFact(args.fact);
                    result = 'Сохранено.';
                } else {
                    result = 'Неизвестный инструмент.';
                }
            } catch (err) {
                console.error('tool call error:', err);
                result = 'Ошибка выполнения инструмента.';
            }

            workingMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: result,
            });
        }
    }

    return null;
}

module.exports = { askAI, MODELS };