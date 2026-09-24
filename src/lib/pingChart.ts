import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';

const W = 1140;
const H = 560;

const C = {
    bg: '#020817',
    filterBg: '#0F172A',
    bottomBg: '#1E293B',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    textDim: '#64748B',
    grid: '#1E293B',
    accent: '#3B82F6',
    accentGreen: '#22C55E',
    selectBg: '#1E293B',
};

export interface PingChartLabels {
    title: string;
    badge: string;
    allRegions: string;
    day: string;
    week: string;
    month: string;
    average: string;
    uptime: string;
    ramLoad: string;
    cpuLoad: string;
    ms: string;
}

export interface PingChartStats {
    avg: number;
    uptime: string;
    ramUsage: number;
    cpuUsage: number;
}

function roundRect(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawGlobeIcon(ctx: SKRSContext2D, cx: number, cy: number, r: number) {
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Меридиан
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Параллели
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.stroke();
}

export function generatePingChart(
    history: number[],
    stats: PingChartStats,
    labels: PingChartLabels,
): Buffer {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // === Фон ===
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // === Заголовок ===
    ctx.fillStyle = C.text;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels.title, 24, 34);

    const titleW = ctx.measureText(labels.title).width;
    const badgeX = 24 + titleW + 12;
    const badgeW = 52;
    const badgeH = 24;
    ctx.fillStyle = '#334155';
    roundRect(ctx, badgeX, 22, badgeW, badgeH, 6);
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels.badge, badgeX + badgeW / 2, 34);

    // === Панель фильтров ===
    const filterY = 70;
    const filterH = 50;
    ctx.fillStyle = C.filterBg;
    roundRect(ctx, 24, filterY, W - 48, filterH, 10);
    ctx.fill();

    // Селект «Все регионы»
    const selX = 40;
    const selY = filterY + 10;
    const selW = 260;
    const selH = 30;
    ctx.fillStyle = C.selectBg;
    roundRect(ctx, selX, selY, selW, selH, 6);
    ctx.fill();

    drawGlobeIcon(ctx, selX + 18, selY + selH / 2, 7);

    ctx.fillStyle = C.text;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels.allRegions, selX + 34, selY + selH / 2);

    // Стрелка вниз
    ctx.beginPath();
    ctx.moveTo(selX + selW - 26, selY + 12);
    ctx.lineTo(selX + selW - 18, selY + 12);
    ctx.lineTo(selX + selW - 22, selY + 18);
    ctx.closePath();
    ctx.fillStyle = C.textMuted;
    ctx.fill();

    // Кнопки День/Неделя/Месяц
    ctx.font = '14px sans-serif';
    const btns = [
        { label: labels.day, active: true },
        { label: labels.week, active: false },
        { label: labels.month, active: false },
    ];
    const btnData = btns.map((b) => ({
        ...b,
        w: ctx.measureText(b.label).width + 24,
    }));
    const totalBtnW = btnData.reduce((s, b) => s + b.w + 8, 0) - 8;
    let btnX = W - 40 - totalBtnW;

    for (const btn of btnData) {
        if (btn.active) {
            ctx.fillStyle = C.text;
            roundRect(ctx, btnX, selY, btn.w, selH, 6);
            ctx.fill();
            ctx.fillStyle = C.bg;
            ctx.font = 'bold 14px sans-serif';
        } else {
            ctx.fillStyle = C.textMuted;
            ctx.font = '14px sans-serif';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, btnX + btn.w / 2, selY + selH / 2);
        btnX += btn.w + 8;
    }

    // === График ===
    const chartX = 70;
    const chartY = 150;
    const chartW = W - 130;
    const chartH = 260;

    // Диапазон Y
    const dataMax = Math.max(...history, 100);
    const yMax = Math.max(50 * Math.ceil(dataMax / 50), 300);

    // Сетка + подписи по Y
    const gridLevels = 4;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < gridLevels; i++) {
        const ratio = i / (gridLevels - 1);
        const y = chartY + chartH * (1 - ratio);
        ctx.beginPath();
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + chartW, y);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.fillText(`${Math.round(yMax * ratio)} ${labels.ms}`, chartX - 8, y);
    }

    // Вертикальная ось слева
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY);
    ctx.lineTo(chartX, chartY + chartH);
    ctx.stroke();

    // Точки данных
    const n = history.length;
    const toXY = (i: number, val: number) => {
        const x = chartX + (i / Math.max(1, n - 1)) * chartW;
        const y = chartY + chartH - (Math.min(val, yMax) / yMax) * chartH;
        return { x, y };
    };

    // Тонкая линия — полупрозрачная
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const { x, y } = toXY(i, history[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Обычные точки — маленькие
    for (let i = 0; i < n; i++) {
        const { x, y } = toXY(i, history[i]);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Максимум — зелёная точка
    let maxIdx = 0;
    for (let i = 0; i < n; i++) if (history[i] > history[maxIdx]) maxIdx = i;
    const maxPt = toXY(maxIdx, history[maxIdx]);
    ctx.fillStyle = C.accentGreen;
    ctx.beginPath();
    ctx.arc(maxPt.x, maxPt.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Последняя — синяя точка
    const lastPt = toXY(n - 1, history[n - 1]);
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Подписи времени по X
    ctx.fillStyle = C.textMuted;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const now = new Date();
    const totalMinutes = 60;
    const timeTicks = 5;
    for (let i = 0; i < timeTicks; i++) {
        const ratio = i / (timeTicks - 1);
        const x = chartX + ratio * chartW;
        const minutesAgo = totalMinutes * (1 - ratio);
        const tm = new Date(now.getTime() - minutesAgo * 60_000);
        const hh = String(tm.getHours()).padStart(2, '0');
        const mm = String(tm.getMinutes()).padStart(2, '0');
        ctx.fillText(`${hh}:${mm}`, x, chartY + chartH + 12);
    }

    // === Нижняя панель ===
    const panelY = H - 100;
    ctx.fillStyle = C.bottomBg;
    ctx.fillRect(0, panelY, W, 100);

    const columns = [
        { title: labels.average, value: `${Math.round(stats.avg)} ${labels.ms}` },
        { title: labels.uptime, value: stats.uptime },
        { title: labels.ramLoad, value: `${stats.ramUsage.toFixed(1)}%` },
        { title: labels.cpuLoad, value: `${stats.cpuUsage.toFixed(1)}%` },
    ];

    const colW = W / 4;
    for (let i = 0; i < columns.length; i++) {
        const cx = colW * i + 40;
        ctx.fillStyle = C.textMuted;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(columns[i].title, cx, panelY + 22);

        ctx.fillStyle = C.text;
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(columns[i].value, cx, panelY + 48);
    }

    return canvas.toBuffer('image/png');
}