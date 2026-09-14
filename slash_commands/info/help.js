const {
    SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
    ApplicationCommandOptionType, ActionRowBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const { getSettings, getDisabledCategories } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const commandExamples = require('../../utils/examples');

const CATEGORY_ORDER = ['admin', 'info', 'moderation', 'settings', 'economy', 'fun', 'music', 'interactions', 'utilities'];

const PERMISSIONS_MAP = {
    ru: {
        [PermissionFlagsBits.Administrator.toString()]: 'Администратор',
        [PermissionFlagsBits.ManageGuild.toString()]: 'Управление сервером',
        [PermissionFlagsBits.ManageMessages.toString()]: 'Управление сообщениями',
        [PermissionFlagsBits.EmbedLinks.toString()]: 'Встраивать ссылки',
        [PermissionFlagsBits.SendMessages.toString()]: 'Отправлять сообщения',
    },
    en: {
        [PermissionFlagsBits.Administrator.toString()]: 'Administrator',
        [PermissionFlagsBits.ManageGuild.toString()]: 'Manage Server',
        [PermissionFlagsBits.ManageMessages.toString()]: 'Manage Messages',
        [PermissionFlagsBits.EmbedLinks.toString()]: 'Embed Links',
        [PermissionFlagsBits.SendMessages.toString()]: 'Send Messages',
    },
    ja: {
        [PermissionFlagsBits.Administrator.toString()]: '管理者',
        [PermissionFlagsBits.ManageGuild.toString()]: 'サーバーの管理',
        [PermissionFlagsBits.ManageMessages.toString()]: 'メッセージの管理',
        [PermissionFlagsBits.EmbedLinks.toString()]: '埋め込みリンク',
        [PermissionFlagsBits.SendMessages.toString()]: 'メッセージを送信',
    },
};

function formatPermissions(bitfield, lang = 'ru') {
    if (!bitfield) return 'Нет';
    const bi = BigInt(bitfield);
    const map = PERMISSIONS_MAP[lang] ?? PERMISSIONS_MAP.ru;
    const result = [];
    for (const [bit, name] of Object.entries(map)) {
        const flag = BigInt(bit);
        if ((bi & flag) === flag) result.push(name);
    }
    return result.length ? result.join('\n') : 'Нет';
}

function getMentions(command, id) {
    const json = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
    const options = json.options ?? [];
    const subs = options.filter(o => o.type === ApplicationCommandOptionType.Subcommand);
    const groups = options.filter(o => o.type === ApplicationCommandOptionType.SubcommandGroup);
    const mentions = [];
    for (const sub of subs) mentions.push(`</${json.name} ${sub.name}:${id}>`);
    for (const group of groups) {
        for (const sub of group.options ?? []) mentions.push(`</${json.name} ${group.name} ${sub.name}:${id}>`);
    }
    if (!mentions.length) mentions.push(`</${json.name}:${id}>`);
    return mentions;
}

async function buildHelpEmbed(client, t, user, guildId) {
    const disabled = await getDisabledCategories(guildId).catch(() => []);
    const categories = new Map();

    for (const command of client.slashCommands.values()) {
        const id = client.slashIds.get(command.data.name);
        if (!id) continue;
        const category = command.category ?? 'other';
        if (disabled.includes(category)) continue;
        if (!categories.has(category)) categories.set(category, []);
        categories.get(category).push(...getMentions(command, id));
    }

    const embed = new EmbedBuilder()
        .setTitle(t.helpTitle)
        .setTimestamp();

    for (const folder of CATEGORY_ORDER) {
        const mentions = categories.get(folder);
        if (!mentions || !mentions.length) continue;
        embed.addFields({
            name: t.categories?.[folder] ?? folder,
            value: mentions.join(' '),
        });
    }

    return embed;
}

function buildCategoryEmbed(client, t, category, guildId, disabled) {
    const embed = new EmbedBuilder()
        .setTitle((t.categories?.[category] ?? category).replace(/<[^>]+>\s*/, '').trim() || category)
        .setTimestamp();

    const lines = [];
    for (const command of client.slashCommands.values()) {
        const id = client.slashIds.get(command.data.name);
        if (!id) continue;
        const cat = command.category ?? 'other';
        if (cat !== category) continue;
        if (disabled.includes(cat)) continue;

        const json = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
        const desc = command.data.description_localizations?.['ru']
            ?? command.data.description_localizations?.['en-US']
            ?? command.data.description
            ?? '—';

        const options = json.options ?? [];
        const hasSubs = options.some(o => o.type === ApplicationCommandOptionType.Subcommand);

        if (hasSubs) {
            for (const sub of options.filter(o => o.type === ApplicationCommandOptionType.Subcommand)) {
                lines.push(`</${json.name} ${sub.name}:${id}> — ${sub.description ?? '—'}`);
            }
        } else {
            lines.push(`</${json.name}:${id}> — ${desc}`);
        }
    }

    embed.setDescription(lines.join('\n') || '—');
    return embed;
}

function buildCategorySelect(t, userId, disabled) {
    const options = [
        { label: t.helpHome ?? 'Главная', value: 'home' },
        ...CATEGORY_ORDER
            .filter(c => !disabled.includes(c))
            .map(c => ({
                label: (t.categories?.[c] ?? c).replace(/<[^>]+>\s*/, '').trim() || c,
                value: c,
            })),
    ];
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`help_cat:${userId}`)
            .setPlaceholder(t.helpSelectCategory ?? 'Выберите категорию')
            .addOptions(options)
    );
}

function buildCommandDetailEmbed(client, command, t, user, lang) {
    const id = client.slashIds.get(command.data.name) ?? '0';
    const options = command.data.options ?? [];
    const subcommands = options.filter(o =>
        o.type === ApplicationCommandOptionType.Subcommand ||
        o.type === ApplicationCommandOptionType.SubcommandGroup
    );

    const targetLang = lang === 'en' ? 'en-US' : lang;
    const description = command.data.description_localizations?.[targetLang]
        ?? command.data.description_localizations?.[lang]
        ?? command.data.description ?? '—';

    const userPerms = command.data.default_member_permissions
        ? formatPermissions(command.data.default_member_permissions, lang)
        : t.none;
    const botPerms = command.botPermissions ? command.botPermissions.join('\n') : t.helpDefaultBotPermissions;
    const cooldownText = `${command.cooldown || 6} ${t.seconds}`;

    const embed = new EmbedBuilder()
        .setTitle(`${t.helpCommandDetailsTitle} </${command.data.name}:${id}>`)
        .setDescription(description)
        .addFields(
            { name: t.helpInfoTitle, value: `${t.helpCooldownTitle}: \`${cooldownText}\`` },
            { name: t.helpBotPermissions, value: botPerms, inline: true },
            { name: t.helpUserPermissions, value: userPerms, inline: true },
        )
        .setTimestamp();

    const examples = commandExamples[command.data.name];
    if (Array.isArray(examples) && examples.length) {
        for (let i = 0; i < examples.length; i++) {
            const ex = examples[i];
            const fullCmd = ex.args ? `/${command.data.name} ${ex.args}` : `/${command.data.name}`;
            const desc = ex.description[lang] ?? ex.description.ru ?? '—';
            embed.addFields({
                name: `${t.exampleWord} №${i + 1}`,
                value: `\`\`\`\n${fullCmd}\n${desc}\n\`\`\``,
            });
        }
    }

    if (subcommands.length) {
        const subs = [];
        for (const sub of subcommands) {
            if (sub.type === ApplicationCommandOptionType.Subcommand) {
                const d = sub.description_localizations?.[targetLang] ?? sub.description ?? '—';
                subs.push(`</${command.data.name} ${sub.name}:${id}> — ${d}`);
            } else if (sub.type === ApplicationCommandOptionType.SubcommandGroup) {
                for (const g of sub.options ?? []) {
                    const d = g.description_localizations?.[targetLang] ?? g.description ?? '—';
                    subs.push(`</${command.data.name} ${sub.name} ${g.name}:${id}> — ${d}`);
                }
            }
        }
        if (subs.length) embed.addFields({ name: t.helpSubcommands, value: subs.join('\n') });
    }

    return embed;
}

module.exports = {
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Список доступных команд')
        .addStringOption(o =>
            o.setName('command')
                .setDescription('Выберите или введите название команды')
                .setAutocomplete(true)
                .setRequired(false)
        ),

    autocompleteExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const targetLang = lang === 'en' ? 'en-US' : lang;
        const focusedValue = interaction.options.getFocused().toLowerCase();

        const filtered = Array.from(client.slashCommands.values())
            .filter(cmd => cmd.data.name.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(filtered.map(cmd => {
            const desc = cmd.data.description_localizations?.[targetLang]
                ?? cmd.data.description_localizations?.[lang]
                ?? cmd.data.description ?? '—';
            return { name: `/${cmd.data.name} — ${desc.slice(0, 40)}`, value: cmd.data.name };
        }));
    },

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;
        const targetCommandName = interaction.options.getString('command');

        if (targetCommandName) {
            const command = client.slashCommands.get(targetCommandName);
            if (!command) {
                const embed = createAlertEmbed('error', user, t.helpNotFound, { action: t.alertActionHelp });
                return interaction.editReply({ embeds: [embed] });
            }
            const embed = buildCommandDetailEmbed(client, command, t, user, lang);
            return interaction.editReply({ embeds: [embed] });
        }

        const disabled = await getDisabledCategories(interaction.guildId).catch(() => []);
        const embed = await buildHelpEmbed(client, t, user, interaction.guildId);
        const select = buildCategorySelect(t, user.id, disabled);

        await interaction.editReply({ embeds: [embed], components: [select] });

        // запоминаем оригиналы для возврата в селекте "Главная"
        if (!client.helpCache) client.helpCache = new Map();
        client.helpCache.set(user.id, { embed, select, disabled });
    },

    components: {
        help_cat: async (client, interaction) => {
            await interaction.deferUpdate();
            const userId = interaction.customId.split(':')[1];
            if (userId !== interaction.user.id) return;

            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const category = interaction.values[0];

            const cached = client.helpCache?.get(userId);
            const disabled = cached?.disabled ?? [];

            let embed;
            if (category === 'home') {
                embed = await buildHelpEmbed(client, t, interaction.user, interaction.guildId);
            } else {
                embed = buildCategoryEmbed(client, t, category, interaction.guildId, disabled);
            }

            const select = buildCategorySelect(t, userId, disabled);
            return interaction.editReply({ embeds: [embed], components: [select] });
        },
    },
};