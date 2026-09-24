import {
    Interaction,
    ChatInputCommandInteraction,
    MessageFlags,
} from 'discord.js';
import { MyClient } from '../client';
import { getGuildSettings } from '../lib/guildSettings';
import { getUserLanguage, t } from '../lib/i18n';
import { UserError } from '../lib/errors';
import { createErrorEmbed } from '../lib/embeds';
import { getAllEntriesForAutocomplete } from '../commands/Info/help';

const ALWAYS_ALLOWED = ['help', 'config'];

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction: Interaction) {
        // ───── Autocomplete ─────
        if (interaction.isAutocomplete()) {
            const client = interaction.client as MyClient;
            const focused = interaction.options.getFocused().toLowerCase();
            const lang = getUserLanguage(interaction as any);

            const all = getAllEntriesForAutocomplete(client, lang);
            const matches = all
                .filter((e) => e.value.toLowerCase().startsWith(focused))
                .slice(0, 25);

            await interaction.respond(matches).catch(() => {});
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const client = interaction.client as MyClient;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        const lang = getUserLanguage(interaction);

        try {
            // 1. Defer ПЕРВЫМ, чтобы не потерять interaction
            if (!command.skipDefer) {
                await interaction.deferReply({
                    flags: command.ephemeral
                        ? MessageFlags.Ephemeral
                        : undefined,
                });
            }

            // 2. Проверка модуля — ПОСЛЕ defer
            if (
                interaction.guildId &&
                !ALWAYS_ALLOWED.includes(interaction.commandName)
            ) {
                const settings = await getGuildSettings(interaction.guildId);
                if (settings.disabled_modules.includes(command.module)) {
                    const embed = createErrorEmbed(
                        interaction.commandName,
                        interaction.user,
                        t(lang, 'errors.moduleDisabled'),
                    );
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({ embeds: [embed] });
                    } else {
                        await interaction.reply({
                            embeds: [embed],
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                    return;
                }
            }

            await command.execute(interaction as ChatInputCommandInteraction);
        } catch (error) {
            const action = interaction.commandName;
            const user = interaction.user;
            let description: string;

            if (error instanceof UserError) {
                description = error.message;
            } else {
                console.error(`[ERROR] ${action}:`, error);
                const errMsg = error instanceof Error ? error.message : String(error);
                description =
                    `${t(lang, 'errors.generic')}\n\n` +
                    '```\n' + errMsg.slice(0, 1500) + '\n```';
            }

            const embed = createErrorEmbed(action, user, description);
            const payload = { embeds: [embed], flags: MessageFlags.Ephemeral };

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(payload);
                } else {
                    await interaction.reply(payload);
                }
            } catch (e) {
                console.error('[ERROR] Не удалось ответить:', e);
            }
        }
    },
};