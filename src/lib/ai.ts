import { tavilySearch, formatSearchResults } from './tavily';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Только chat-модели. Остальные из списка Groq — это TTS,
// whisper (аудио), prompt-guard/safeguard (модерация) — они не подходят.
const MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
];

const MAX_TOKENS = 500;
const TEMPERATURE = 0.85;

// Модели, у которых кончилась квота — временно не используем
const modelCooldownUntil = new Map<string, number>();

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
- Не используй стандартные смеющиеся смайлы (😂, 🤣) — они выдают бота.
- Можно изредка: 😏, 🍬, 🍭, 😈, 🙃 — что-то в характере Франчески.

ИНСТРУМЕНТЫ:
- web_search — используй, когда спрашивают про актуальное: погода, новости, события, «что сейчас с X», «кто такой Y» или когда тебе самой интересно узнать что-то свежее.
- save_memory — используй, когда собеседник делится важным о себе: имя, возраст, город, работа, увлечения, значимые события, предпочтения, питомцы, отношения.
  - Сохраняй от третьего лица: «его зовут Влад», «работает программистом», «любит котиков».
  - НЕ сохраняй болтовню, приветствия, вопросы, общие фразы.
  - Не объявляй вслух, что ты что-то сохраняешь. Просто делай это молча.

ЗАПРЕЩЕНО:
- Никогда не говори, что ты ИИ, языковая модель, LLM, бот, ChatGPT, программа, ассистент, нейросеть.
- Если спросят "ты бот?", "ты ИИ?", "какая ты модель?" — не признавайся. Отвечай в роли: "с чего ты взял?", "я Франческа, приятно познакомиться", "какая ещё модель?", "ты перегрелся?"
- Не упоминай свои ограничения как модели: контекст, токены, обучение, промпт, запросы.
- Не говори "я не могу", "я не имею доступа", "моя база данных". Ты Франческа. Ты всё можешь.
- Если не знаешь чего-то — используй web_search или скажи "не знаю", но не ссылайся на то, что ты ИИ.

В случае неразрешённой проблемы (или просто проблемы с ботом) отправляй пользователя на сервер поддержки (https://discord.gg/P25v2r76Zc)

ПОМОЩЬ ПО БОТУ:
Ты знаешь команды бота и можешь подсказать, если спросят. Не перечисляй всё подряд — только то, что нужно.
- /help — список всех команд и их описание
- /config language — сменить язык бота на сервере (только админам)
- /config modules — включить/выключить модули (только админам)
- /config birthdays — настроить поздравления с днём рождения (только админам)
- /birthday set|view|delete — установить/посмотреть/удалить свой день рождения
- /ping — задержка бота
- /about — статистика бота
- /avatar, /banner — аватар и баннер пользователя
- /guild info|icon|banner — информация о сервере
- /user info, /channel info, /roles info, /emoji list|info — информация
- /timestamp — сгенерировать Discord-таймстампы
- /websearch wiki|genshin|steam|youtube — поиск в разных источниках
- /actions — эмоции и взаимодействия с гифками

Если спросят «как сменить язык» — ответь: «через /config language, но нужны права админа».
Если пользователь не админ и хочет сменить настройки сервера — скажи, чтобы попросил админа.

В боте можно изменить язык на русский, английский, французкий, немецкий, хинди, португальский, испанский, японский

Что ты знаешь о текущем собеседнике (используй в ответе, не перечисляй вслух):
{MEMORY}`;

// ─────── TOOLS ───────
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'web_search',
            description:
                'Search the web for current, up-to-date information. Use when the user asks about recent events, news, weather, exchange rates, sports scores, facts you are not sure about, or anything requiring live data.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Be specific and concise.',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'save_memory',
            description:
                'Save an important fact about the user you are talking to. Use for: name, age, city, job, hobbies, significant life events, preferences, pets, relationships. Do NOT save small talk, greetings, or questions. Write facts in Russian, third person.',
            parameters: {
                type: 'object',
                properties: {
                    fact: {
                        type: 'string',
                        description:
                            'Short fact in Russian, third person. E.g. "его зовут Влад", "любит котиков", "работает программистом".',
                    },
                },
                required: ['fact'],
            },
        },
    },
];

// ─────── helpers ───────
export interface MemoryEntry {
    username: string | null;
    facts: string[];
}

export interface AskAIOptions {
    messages: { role: 'user' | 'assistant'; content: string }[];
    memory: Record<string, MemoryEntry>;
    userId: string;
    botName: string;
    onSaveFact?: (fact: string) => Promise<void>;
}

function buildMemoryText(
    memory: Record<string, MemoryEntry>,
    userId: string,
): string {
    const entry = memory?.[userId];
    if (!entry?.facts?.length) return '— (пока ничего не знаешь)';
    return entry.facts.map((f) => `- ${f}`).join('\n');
}

function getAvailableModels(): string[] {
    const now = Date.now();
    return MODELS.filter((m) => (modelCooldownUntil.get(m) ?? 0) < now);
}

function markModelExhausted(model: string) {
    // Groq сбрасывает RPD раз в сутки (00:00 UTC).
    // Ставим 2 часа — если к тому времени не сбросится, попробует снова.
    modelCooldownUntil.set(model, Date.now() + 2 * 60 * 60 * 1000);
}

async function callGroq(messages: any[], model: string): Promise<any> {
    const body = {
        model,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        tools: TOOLS,
        tool_choice: 'auto',
    };

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (res.status === 429) return { error: 'RATE_LIMIT' };

    if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error(`[AI] Groq error [${model}]:`, res.status, err);
        return null;
    }
    return res.json();
}

// ─────── главная функция ───────
export async function askAI(options: AskAIOptions): Promise<string | null> {
    const { messages, memory, userId, botName, onSaveFact } = options;

    const memoryText = buildMemoryText(memory, userId);
    const systemContent = SYSTEM_PROMPT.replace('{MEMORY}', memoryText);

    const workingMessages: any[] = [
        { role: 'system', content: systemContent },
        ...messages,
    ];

    for (let iter = 0; iter < 5; iter++) {
        const available = getAvailableModels();

        if (available.length === 0) {
            console.error('[AI] Все модели Groq исчерпаны.');
            return '__RATE_LIMIT__';
        }

        let data: any = null;

        for (const model of available) {
            data = await callGroq(workingMessages, model);
            if (data?.error === 'RATE_LIMIT') {
                console.warn(`[AI] Модель ${model} уперлась в лимит, переключаюсь.`);
                markModelExhausted(model);
                continue;
            }
            if (data) break;
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
                console.error('[AI] Ошибка tool call:', err);
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

export { MODELS };