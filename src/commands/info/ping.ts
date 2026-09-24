import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { MyClient } from '../../client';
import { supabase } from '../../lib/supabase';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';

export default {
    skipDefer: true, // сами управляем defer (нужен fetchReply)
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Shows the bot's latency statistics.")
        .setDescriptionLocalizations(getLocalizations('commands.ping.description')),

    async execute(interaction: ChatInputCommandInteraction) {
        const sent = await interaction.deferReply({ fetchReply: true });
        const client = interaction.client as MyClient;
        const lang = getUserLanguage(interaction);

        const wsLatency = client.ws.ping;
        const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;

        let dbLatency = -1;
        try {
            const start = Date.now();
            await supabase.from('guild_settings').select('guild_id').limit(1);
            dbLatency = Date.now() - start;
        } catch {
            dbLatency = -1;
        }

        const shardId = client.ws.shards.first()?.id ?? 0;
        const dbValue = dbLatency > -1 ? `${dbLatency}ms` : t(lang, 'ping.error');

        const lines = [
            `${t(lang, 'ping.cluster')}: Alice (1/1)`,
            `${t(lang, 'ping.shards')}: [ ${shardId} — ${shardId} ]`,
            `   — ${t(lang, 'ping.ws')}: ${Math.round(wsLatency)}ms`,
            `   — ${t(lang, 'ping.roundtrip')}: ${roundtripLatency}ms`,
            `   — ${t(lang, 'ping.database')}: ${dbValue}`,
        ];

        await interaction.editReply({ content: lines.join('\n') });
    },
};