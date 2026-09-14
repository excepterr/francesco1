const {
    SlashCommandBuilder, MessageFlags,
    ContainerBuilder, TextDisplayBuilder,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const supabase = require('../../utils/supabase');

const MIN_YEAR = 1900;

function formatBirthday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
}

function validateDate(day, month, year) {
    if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // проверка через реальную дату — ловит 31.02, 30.02 и т.д.
    const testYear = year ?? 2024; // високосный, чтобы 29.02 проходило
    const testDate = new Date(Date.UTC(testYear, month - 1, day));
    if (testDate.getUTCDate() !== day || testDate.getUTCMonth() !== month - 1) return false;

    // если указан год — разумные пределы
    if (year !== null) {
        const currentYear = new Date().getUTCFullYear();
        if (year < MIN_YEAR || year > currentYear) return false;
    }
    return true;
}

function buildContainer(content, title) {
    const c = new ContainerBuilder().setAccentColor(null);
    if (title) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return c;
}

module.exports = {
    cooldown: 5,
    botPermissions: ['Встраивать ссылки'],

    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Управление днями рождения участников')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Установить свой день рождения')
                .addStringOption(opt =>
                    opt.setName('date')
                        .setDescription('Дата в формате ДД.ММ или ДД.ММ.ГГГГ')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Посмотреть свой ДР или список всех именинников')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('Пользователь для просмотра (необязательно)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('delete').setDescription('Удалить свой день рождения')
        ),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const subcommand = interaction.options.getSubcommand();

        // ─── set ───
        if (subcommand === 'set') {
            const dateStr = interaction.options.getString('date');
            const match = dateStr.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);

            if (!match) {
                const embed = createAlertEmbed('error', interaction.user, t.birthdayInvalidDate);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const year = match[3] ? parseInt(match[3], 10) : null;

            if (!validateDate(day, month, year)) {
                const embed = createAlertEmbed('error', interaction.user, t.birthdayInvalidDate);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const { data: existing } = await supabase
                .from('birthdays')
                .select('id')
                .eq('user_id', interaction.user.id)
                .eq('guild_id', interaction.guildId)
                .maybeSingle();

            if (existing) {
                const embed = createAlertEmbed('error', interaction.user, t.birthdayAlreadySet);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const dbYear = year ?? 2000;
            const birth_date = `${dbYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            const { error } = await supabase
                .from('birthdays')
                .insert({
                    user_id: String(interaction.user.id),
                    guild_id: String(interaction.guildId),
                    birth_date,
                });

            if (error) {
                console.error('Birthday set error:', error);
                const embed = createAlertEmbed('error', interaction.user, t.errorOccurred);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const shown = formatBirthday(birth_date) + (year ? `.${year}` : '');
            const embed = createAlertEmbed('success', interaction.user, t.birthdaySetSuccess(shown));
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // ─── view ───
        if (subcommand === 'view') {
            const targetUser = interaction.options.getUser('user');

            // чужой профиль
            if (targetUser && targetUser.id !== interaction.user.id) {
                const { data } = await supabase
                    .from('birthdays')
                    .select('birth_date')
                    .eq('user_id', targetUser.id)
                    .eq('guild_id', interaction.guildId)
                    .maybeSingle();

                if (!data) {
                    const embed = createAlertEmbed('info', interaction.user, t.birthdayNotFound);
                    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }

                const container = buildContainer(
                    `${targetUser.username}: ${t.birthdayField(formatBirthday(data.birth_date))}`,
                    t.birthdayTitle,
                );

                return interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            // общий список
            const { data } = await supabase
                .from('birthdays')
                .select('user_id, birth_date')
                .eq('guild_id', interaction.guildId);

            if (!data || data.length === 0) {
                const embed = createAlertEmbed('info', interaction.user, t.birthdayNoBirthdays);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const sorted = [...data].sort((a, b) => {
                const da = new Date(a.birth_date + 'T00:00:00Z');
                const db = new Date(b.birth_date + 'T00:00:00Z');
                const keyA = (da.getUTCMonth() + 1) * 100 + da.getUTCDate();
                const keyB = (db.getUTCMonth() + 1) * 100 + db.getUTCDate();
                return keyA - keyB;
            });

            const lines = [];
            for (const rec of sorted) {
                const member = await interaction.guild.members.fetch(rec.user_id).catch(() => null);
                if (!member) continue;
                lines.push(`${member.user.username.padEnd(20)} — ${formatBirthday(rec.birth_date)}`);
            }

            if (lines.length === 0) {
                const embed = createAlertEmbed('info', interaction.user, t.birthdayNoBirthdays);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const container = buildContainer(
                '```\n' + lines.join('\n') + '\n```',
                t.birthdayTitle,
            );

            return interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ─── delete ───
        if (subcommand === 'delete') {
            const { data: existing } = await supabase
                .from('birthdays')
                .select('id')
                .eq('user_id', interaction.user.id)
                .eq('guild_id', interaction.guildId)
                .maybeSingle();

            if (!existing) {
                const embed = createAlertEmbed('info', interaction.user, t.birthdayViewSelf);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const { error } = await supabase
                .from('birthdays')
                .delete()
                .eq('user_id', interaction.user.id)
                .eq('guild_id', interaction.guildId);

            if (error) {
                console.error('Birthday delete error:', error);
                const embed = createAlertEmbed('error', interaction.user, t.errorOccurred);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const embed = createAlertEmbed('success', interaction.user, t.birthdayDeleteSuccess);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};