import i18next from 'i18next';
import fs from 'fs';
import path from 'path';

// Названия языков для отображения (если пригодится в команде /language)
export const languages = {
    en: 'English',
    ru: 'Русский',
    ja: '日本語',
    de: 'Deutsch',
    pt: 'Português',
    es: 'Español',
    hi: 'हिन्दी',
    fr: 'Français',
};

// 👇 ВАЖНО: Discord использует свои коды локалей.
// Например, для английского — 'en-US', для португальского — 'pt-BR'.
// Без этой карты `setNameLocalizations` не поймёт наши короткие коды.
export const discordLocaleMap: Record<string, string> = {
    en: 'en-US',
    ru: 'ru',
    ja: 'ja',
    de: 'de',
    pt: 'pt-BR',
    es: 'es-ES',
    hi: 'hi',
    fr: 'fr',
};

// Здесь будем держать сырые переводы для быстрого доступа
export const rawTranslations: Record<string, any> = {};

// Получить язык пользователя из его Discord-клиента
export function getUserLanguage(interaction: any): string {
    const locale = interaction.locale?.split('-')[0] || 'en';
    return languages[locale as keyof typeof languages] ? locale : 'en';
}

// Получить перевод
export function t(lang: string, key: string, options?: any): string {
    return i18next.t(key, { lng: lang, ...options });
}

// Инициализация i18next — читаем плоские файлы
export async function initI18n() {
    const localesPath = path.join(__dirname, '..', 'locales');
    const files = fs.readdirSync(localesPath).filter(f => f.endsWith('.json'));

    const resources: Record<string, any> = {};

    for (const file of files) {
        const lang = path.basename(file, '.json');
        const content = JSON.parse(fs.readFileSync(path.join(localesPath, file), 'utf-8'));
        resources[lang] = { translation: content };
        rawTranslations[lang] = content;
    }

    await i18next.init({
        lng: 'en',
        fallbackLng: 'en',
        resources,
        interpolation: { escapeValue: false },
    });

    console.log(`[I18N] Загружено ${Object.keys(resources).length} языков: ${Object.keys(resources).join(', ')}`);
}

/**
 * Хелпер для локализации слэш-команд.
 * Принимает путь к ключу, например 'ping.description',
 * и возвращает объект { 'en-US': '...', 'ru': '...', 'pt-BR': '...' }.
 */
export function getLocalizations(keyPath: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [lang, discordLocale] of Object.entries(discordLocaleMap)) {
        const value = getNestedValue(rawTranslations[lang], keyPath);
        if (value && typeof value === 'string') {
            result[discordLocale] = value;
        }
    }

    return result;
}

// Достаёт значение из вложенного объекта по пути "ping.description"
function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}