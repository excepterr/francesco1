const { SlashCommandBuilder } = require('discord.js');

const CLUSTER_NAME = 'Alice';
const SEGMENT_START = 0;
const SEGMENT_END = 0;

async function measureDb() {
    const start = performance.now();
    try {
        const supabase = require('../../utils/supabase');
        await supabase
            .from('guild_settings')
            .select('guild_id', { head: true, count: 'exact' });
        return Math.round(performance.now() - start);
    } catch {
        return '—';
    }
}

function buildPingText(client, processingMs, dbMs) {
    const shards = client.ws.shards.size;
    return [
        `Кластер: **${CLUSTER_NAME}** (${shards}/${shards})`,
        `Сегменты: [ ${SEGMENT_START} — ${SEGMENT_END} ]`,
        `   — Задержка: ${client.ws.ping}ms`,
        `   — Обработка команд: ${processingMs}ms`,
        `   — База данных: ${dbMs}ms`,
    ].join('\n');
}

module.exports = {
    cooldown: 6,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Проверка задержки бота'),

    slashExecute: async (client, interaction) => {
        const processingMs = Math.max(0, Math.round(Date.now() - interaction.createdTimestamp));
        const dbMs = await measureDb();

        await interaction.reply({
            content: buildPingText(client, processingMs, dbMs),
            allowedMentions: { parse: [], repliedUser: false }
        });
    },
};
