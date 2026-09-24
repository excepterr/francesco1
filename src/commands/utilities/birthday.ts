import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import {
    getBirthday,
    setBirthday,
    deleteBirthday,
} from '../../lib/birthdays';

const MONTHS_RU = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(
    day: number,
    month: number,
    year: number | null,
    lang: string,
): string {
    const monthName = lang === 'ru' ? MONTHS_RU[month - 1] : MONTHS_EN[month - 1];
    return year ? `${day} ${monthName} ${year}` : `${day} ${monthName}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Manage birthdays.')
        .setDescriptionLocalizations(getLocalizations('birthday.description'))
        .addSubcommand((sub) =>
            sub
                .setName('set')
                .setDescription('Set your birthday.')
                .setDescriptionLocalizations(getLocalizations('birthday.set.description'))
                .addIntegerOption((opt) =>
                    opt
                        .setName('day')
                        .setDescription('Day (1-31).')
                        .setDescriptionLocalizations(
                            getLocalizations('birthday.set.dayOption'),
                        )
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31),
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('month')
                        .setDescription('Month (1-12).')
                        .setDescriptionLocalizations(
                            getLocalizations('birthday.set.monthOption'),
                        )
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(12),
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('year')
                        .setDescription('Year (optional, will be shown in profile).')
                        .setDescriptionLocalizations(
                            getLocalizations('birthday.set.yearOption'),
                        )
                        .setMinValue(1900)
                        .setMaxValue(new Date().getFullYear()),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('view')
                .setDescription("View someone's birthday.")
                .setDescriptionLocalizations(getLocalizations('birthday.view.description'))
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('The user whose birthday to view.')
                        .setDescriptionLocalizations(
                            getLocalizations('birthday.view.userOption'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('delete')
                .setDescription('Delete your birthday.')
                .setDescriptionLocalizations(
                    getLocalizations('birthday.delete.description'),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            throw new UserError(t(getUserLanguage(interaction), 'errors.guildOnly'));
        }

        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        // ============ SET ============
        if (sub === 'set') {
            const day = interaction.options.getInteger('day', true);
            const month = interaction.options.getInteger('month', true);
            const year = interaction.options.getInteger('year');

            // Проверка: день существует в этом месяце?
            const maxDay = new Date(year ?? 2024, month, 0).getDate();
            if (day > maxDay) {
                throw new UserError(
                    t(lang, 'birthday.invalidDate', { max: maxDay, month }),
                );
            }

            const ok = await setBirthday(guildId, interaction.user.id, day, month, year);
            if (!ok) throw new UserError(t(lang, 'birthday.saveError'));

            const dateStr = formatDate(day, month, year, lang);
            const embed = new EmbedBuilder()
                .setDescription(
                    `### ${t(lang, 'birthday.set.title')}\n\n${t(lang, 'birthday.set.success', { date: dateStr })}`,
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ============ VIEW ============
        if (sub === 'view') {
            const target = interaction.options.getUser('user') ?? interaction.user;
            const birthday = await getBirthday(guildId, target.id);

            if (!birthday) {
                if (target.id === interaction.user.id) {
                    throw new UserError(t(lang, 'birthday.view.selfNotFound'));
                }
                throw new UserError(
                    t(lang, 'birthday.view.notFound', { user: target.username }),
                );
            }

            const dateStr = formatDate(
                birthday.day,
                birthday.month,
                birthday.year,
                lang,
            );

            const embed = new EmbedBuilder()
                .setDescription(
                    `### ${t(lang, 'birthday.view.title')} — ${target.username}\n\n${dateStr}`,
                )
                .setThumbnail(target.displayAvatarURL({ size: 256 }))
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ============ DELETE ============
        if (sub === 'delete') {
            const existing = await getBirthday(guildId, interaction.user.id);
            if (!existing) {
                throw new UserError(t(lang, 'birthday.delete.notFound'));
            }

            const ok = await deleteBirthday(guildId, interaction.user.id);
            if (!ok) throw new UserError(t(lang, 'birthday.delete.error'));

            const embed = new EmbedBuilder()
                .setDescription(
                    `### ${t(lang, 'birthday.delete.title')}\n\n${t(lang, 'birthday.delete.success')}`,
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    },
};