import fs from 'fs';
import path from 'path';

export function loadCommandIds(): Record<string, string> {
    try {
        const idsPath = path.join(__dirname, '..', '..', 'command-ids.json');
        return JSON.parse(fs.readFileSync(idsPath, 'utf-8'));
    } catch {
        return {};
    }
}

export function pingCommand(name: string): string {
    const id = loadCommandIds()[name];
    return id ? `</${name}:${id}>` : `\`/${name}\``;
}

/** Формат: 22.09.2026, 17:08:04 */
export function formatDate(ts: number): string {
    return new Date(ts).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}