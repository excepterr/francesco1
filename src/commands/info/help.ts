import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { MyClient } from '../../client';
import { t, getLocalizations, getUserLanguage } from '../../lib/i18n';
import { createCollector } from '../../lib/components';
import { getGuildSettings } from '../../lib/guildSettings';

const MODULE_ORDER = [
    'administrative',
    'moderation',
    'info',
    'fun',
    'economy',
    'interactions',
    'text',        // ← добавь сюда
    'music',
    'utilities',
];

const HOME_VALUE = '__home__';

function loadCommandIds(): Record<string, string> {
    try {
        const idsPath = path.join(__dirname, '..', '..', '..', 'command-ids.json');
        return JSON.parse(fs.readFileSync(idsPath, 'utf-8'));
    } catch {
        return {};
    }
}

export interface HelpEntry {
    displayName: string;
    pingName: string;
    parentName: string;
    descKey: string;
}

function pingFor(pingName: string, parentName: string): string {
    const ids = loadCommandIds();
    const id = ids[parentName];
    return id ? `</${pingName}:${id}>` : `\`/${pingName}\``;
}

export function getEntries(cmd: any): HelpEntry[] {
    const key = cmd.localizationKey ?? cmd.data.name;
    const data = cmd.data.toJSON();
    const options = data.options ?? [];

    const subs = options.filter((o: any) => o.type === 1);
    const groups = options.filter((o: any) => o.type === 2);

    if (subs.length === 0 && groups.length === 0) {
        return [{
            displayName: cmd.data.name,
            pingName: cmd.data.name,
            parentName: cmd.data.name,
            descKey: `commands.${key}.description`,
        }];
    }

    const entries: HelpEntry[] = [];
    for (const s of subs) {
        entries.push({
            displayName: `${cmd.data.name} ${s.name}`,
            pingName: `${cmd.data.name} ${s.name}`,
            parentName: cmd.data.name,
            descKey: `commands.${key}.${s.name}.description`,
        });
    }
    for (const g of groups) {
        const groupSubs = (g.options ?? []).filter((o: any) => o.type === 1);
        for (const s of groupSubs) {
            entries.push({
                displayName: `${cmd.data.name} ${g.name} ${s.name}`,
                pingName: `${cmd.data.name} ${g.name} ${s.name}`,
                parentName: cmd.data.name,
                descKey: `commands.${key}.${g.name}.${s.name}.description`,
            });
        }
    }
    return entries;
}

/**
 * Собирает все записи для автокомплита (с описаниями).
 */
export function getAllEntriesForAutocomplete(
    client: MyClient,
    lang: string,
): { name: string; value: string }[] {
    const result: { name: string; value: string }[] = [];

    for (const [, cmd] of client.commands) {
        const entries = getEntries(cmd);
        for (const e of entries) {
            const desc = t(lang, e.descKey);
            const hasDesc = desc && desc !== e.descKey;
            // Discord: name max 100 символов
            const label = hasDesc
                ? `${e.displayName} — ${desc}`.slice(0, 100)
                : e.displayName;
            result.push({ name: label, value: e.displayName });
        }
    }

    return result;
}

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List of available commands.')
        .setDescriptionLocalizations(getLocalizations('help.description'))
        .addStringOption((opt) =>
            opt
                .setName('command')
                .setDescription('Get detailed information about a command.')
                .setDescriptionLocalizations(getLocalizations('help.commandOption'))
                .setAutocomplete(true),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const client = interaction.client as MyClient;
        const lang = getUserLanguage(interaction);
        const commandName = interaction.options.getString('command');

        if (commandName) {
            return showCommandDetails(interaction, client, commandName, lang);
        }

        const settings = interaction.guildId
            ? await getGuildSettings(interaction.guildId)
            : { disabled_modules: [] as string[] };

        const grouped: Record<string, HelpEntry[]> = {};
        for (const [, cmd] of client.commands) {
            const isAlwaysOn = ['help', 'config'].includes(cmd.data.name);
            if (!isAlwaysOn && settings.disabled_modules.includes(cmd.module)) continue;

            if (!grouped[cmd.module]) grouped[cmd.module] = [];
            grouped[cmd.module].push(...getEntries(cmd));
        }

        const moduleLabel = (mod: string) => {
            const key = `modules.${mod}`;
            const translated = t(lang, key);
            return translated === key ? mod : translated;
        };

        const modules = Object.keys(grouped).sort((a, b) => {
            const ai = MODULE_ORDER.indexOf(a);
            const bi = MODULE_ORDER.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });

        const buildMenu = () =>
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_select')
                    .setPlaceholder(t(lang, 'help.selectPlaceholder'))
                    .addOptions([
                        { label: t(lang, 'help.homeOption'), value: HOME_VALUE },
                        ...modules.map((m) => ({
                            label: moduleLabel(m),
                            value: m,
                        })),
                    ]),
            );

        const mainEmbed = buildMainEmbed(lang, grouped, moduleLabel, modules);

        const response = await interaction.editReply({
            embeds: [mainEmbed],
            components: modules.length > 0 ? [buildMenu()] : [],
        });

        if (modules.length === 0) return;

        createCollector(interaction.user.id, response, {
            lang,
            onCollect: async (i) => {
                if (!i.isStringSelectMenu()) return;
                const value = i.values[0];

                if (value === HOME_VALUE) {
                    await i.update({
                        embeds: [mainEmbed],
                        components: [buildMenu()],
                    });
                    return;
                }

                const entries = grouped[value] ?? [];
                const lines = entries.map((e) => {
                    const desc = t(lang, e.descKey);
                    return `${pingFor(e.pingName, e.parentName)} — ${desc}`;
                });

                const moduleEmbed = new EmbedBuilder()
                    .setTitle(`${t(lang, 'help.moduleTitle')} — ${moduleLabel(value)}`)
                    .setDescription(lines.join('\n'))
                    .setTimestamp();

                await i.update({
                    embeds: [moduleEmbed],
                    components: [buildMenu()],
                });
            },
        });
    },
};

function buildMainEmbed(
    lang: string,
    grouped: Record<string, HelpEntry[]>,
    moduleLabel: (mod: string) => string,
    modules: string[], // <-- добавляем параметр
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(t(lang, 'help.title'))
        .setTimestamp();
    // thumbnail убран

    // Итерируемся по отсортированному массиву modules
    for (const moduleName of modules) {
        const entries = grouped[moduleName] ?? [];
        const value = entries
            .map((e) => pingFor(e.pingName, e.parentName))
            .join(' ');
        embed.addFields({ name: moduleLabel(moduleName), value, inline: false });
    }
    return embed;
}

/**
 * /help <command>
 * Поддерживает examples как массив. Если массива нет — берёт строку `example`.
 */
async function showCommandDetails(
    interaction: ChatInputCommandInteraction,
    client: MyClient,
    commandName: string,
    lang: string,
) {
    const parts = commandName.split(' ');
    const parent = parts[0];
    const subParts = parts.slice(1);

    const cmd = client.commands.get(parent);
    if (!cmd) {
        await interaction.editReply({
            content: t(lang, 'help.commandNotFound', { name: commandName }),
        });
        return;
    }

    const key = cmd.localizationKey ?? parent;
    const prefix = subParts.length
        ? `commands.${key}.${subParts.join('.')}`
        : `commands.${key}`;

    const embed = new EmbedBuilder()
        .setTitle(`${t(lang, 'help.commandInfo')}: /${commandName}`)
        .setTimestamp()
        .setDescription(t(lang, `${prefix}.longDescription`))
        .addFields({
            name: t(lang, 'help.fieldInfo'),
            value: [
                `${t(lang, 'help.fieldCooldown')}: \`${t(lang, `${prefix}.cooldown`)}\``,
                `${t(lang, 'help.fieldBotPerms')}: ${t(lang, `${prefix}.botPermissions`)}`,
                `${t(lang, 'help.fieldUserPerms')}: ${t(lang, `${prefix}.userPermissions`)}`,
            ].join('\n'),
        });

    // Примеры: сначала пробуем массив, потом строку
    const examplesArray = safeArray(t(lang, `${prefix}.examples`, {
        returnObjects: true,
    }));

    if (examplesArray && examplesArray.length > 0) {
        examplesArray.forEach((ex, idx) => {
            embed.addFields({
                name: t(lang, 'help.fieldExampleN', { n: idx + 1 }),
                value: '```\n' + String(ex) + '\n```',
            });
        });
    } else {
        const single = t(lang, `${prefix}.example`);
        if (single && single !== `${prefix}.example`) {
            embed.addFields({
                name: t(lang, 'help.fieldExampleN', { n: 1 }),
                value: '```\n' + single + '\n```',
            });
        }
    }

    await interaction.editReply({ embeds: [embed] });
}

function safeArray(value: any): string[] | null {
    if (Array.isArray(value)) return value.map(String);
    return null;
}