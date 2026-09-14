const {
    SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

module.exports = {
    cooldown: 10,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('infrastructure')
        .setDescription('Инструменты инфраструктуры сервера')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub =>
            sub.setName('banlist')
                .setDescription('Показать список забаненных пользователей')
                .addStringOption(o => o.setName('query').setDescription('Поиск по имени или ID')))
        .addSubcommand(sub =>
            sub.setName('prune')
                .setDescription('Кикнуть неактивных участников')
                .addIntegerOption(o => o.setName('days').setDescription('Дней неактивности').setMinValue(1).setMaxValue(30).setRequired(true))
                .addRoleOption(o => o.setName('exclude_role').setDescription('Исключить роль')))
        .addSubcommand(sub =>
            sub.setName('staff')
                .setDescription('Список модераторов сервера')
                .addRoleOption(o => o.setName('role').setDescription('Конкретная роль'))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;
        const guild = interaction.guild;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            const embed = createAlertEmbed('error', user, t.modNoPerms);
            return interaction.editReply({ embeds: [embed] });
        }

        // ─── banlist ───
        if (sub === 'banlist') {
            const query = interaction.options.getString('query');
            const bans = await guild.bans.fetch();

            let filtered = bans;
            if (query) {
                const q = query.toLowerCase();
                filtered = bans.filter(b =>
                    b.user.username.toLowerCase().includes(q) ||
                    b.user.id.includes(q)
                );
            }

            if (filtered.size === 0) {
                const embed = createAlertEmbed('warning', user, query ? t.infraBanlistNoResults : t.infraBanlistEmpty);
                return interaction.editReply({ embeds: [embed] });
            }

            const lines = [...filtered.values()].slice(0, 50).map((b, i) => {
                const reason = b.reason || t.modNoReason;
                return `${i + 1}. ${b.user.tag} (${b.user.id}) | ${reason}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(t.infraBanlistTitle)
                .setDescription('```\n' + lines.join('\n') + '\n```')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ─── prune ───
        if (sub === 'prune') {
            const days = interaction.options.getInteger('days');
            const excludeRole = interaction.options.getRole('exclude_role');

            const members = await guild.members.fetch();
            const now = Date.now();
            const threshold = now - (days * 86400_000);

            const targets = [];
            for (const [, m] of members) {
                if (m.user.bot) continue;
                if (m.permissions.has(PermissionFlagsBits.KickMembers)) continue;
                if (excludeRole && m.roles.cache.has(excludeRole.id)) continue;
                if (!m.joinedAt || m.joinedAt.getTime() > threshold) continue;
                targets.push(m);
            }

            if (targets.length === 0) {
                const embed = createAlertEmbed('warning', user, t.infraPruneNone(days));
                return interaction.editReply({ embeds: [embed] });
            }

            const kicked = [];
            let failed = 0;
            for (const m of targets) {
                try {
                    await m.kick(t.infraPruneReason(days));
                    kicked.push(m.user.tag);
                } catch { failed++; }
            }

            const list = kicked.slice(0, 50).map((tag, i) => `${i + 1}. ${tag}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle(t.infraPruneSuccess(kicked.length, failed, days))
                .setDescription('```\n' + (list || '—') + '\n```')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ─── staff ───
        if (sub === 'staff') {
            const specificRole = interaction.options.getRole('role');
            const members = await guild.members.fetch();
            const staff = [];

            for (const [, m] of members) {
                if (m.user.bot) continue;
                if (specificRole) {
                    if (m.roles.cache.has(specificRole.id)) staff.push(m);
                } else if (
                    m.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                    m.permissions.has(PermissionFlagsBits.KickMembers) ||
                    m.permissions.has(PermissionFlagsBits.BanMembers)
                ) {
                    staff.push(m);
                }
            }

            if (staff.length === 0) {
                const embed = createAlertEmbed('warning', user,
                    specificRole ? t.infraStaffNoneRole(specificRole.name) : t.infraStaffNone);
                return interaction.editReply({ embeds: [embed] });
            }

            staff.sort((a, b) => b.roles.highest.position - a.roles.highest.position);

            const lines = staff.slice(0, 50).map((m, i) =>
                `${i + 1}. ${m.user.tag} (${m.id}) | ${m.roles.highest.name}`
            );

            const embed = new EmbedBuilder()
                .setTitle(specificRole ? `${t.infraStaffTitle} — ${specificRole.name}` : t.infraStaffTitle)
                .setDescription('```\n' + lines.join('\n') + '\n```')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    },
};