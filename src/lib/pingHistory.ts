import type { MyClient } from '../client';

class PingHistory {
    private data: number[] = [];
    private maxSize = 120; // 120 точек по 30 сек = 1 час
    private interval: NodeJS.Timeout | null = null;

    push(ping: number) {
        this.data.push(Math.round(ping));
        if (this.data.length > this.maxSize) this.data.shift();
    }

    get(): number[] {
        // Гарантируем хотя бы 2 точки, чтобы график рисовался
        if (this.data.length < 2) return [0, this.data[0] ?? 0];
        return this.data;
    }

    getAvg(): number {
        if (this.data.length === 0) return 0;
        return this.data.reduce((a, b) => a + b, 0) / this.data.length;
    }

    getMax(): number {
        return this.data.length === 0 ? 0 : Math.max(...this.data);
    }

    start(client: MyClient) {
        if (this.interval) return;
        // Первая точка сразу
        this.push(client.ws.ping);
        // Дальше — каждые 30 секунд
        this.interval = setInterval(() => {
            this.push(client.ws.ping);
        }, 30_000);
    }
}

export const pingHistory = new PingHistory();