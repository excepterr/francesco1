const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, addWarning, getWarnings, removeWarning, clearWarnings, sendModlog } = require('../../utils/moderation');

const COLOR = 0x2f3236;

module.exports = {
    cooldown: 4,
    botPermissions: ['Встраивать ссылки'],

    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Система предупреждений')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub => sub.setName('add').setDescription('Выдать предупреждение')
            .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(false)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Удалить предупреждение по номеру')
            .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
            .addIntegerOption(o => o.setName('id').setDescription('Номер предупреждения').setMinValue(1).setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(false)))
        .addSubcommand(sub => sub.setName('purge').setDescription('Удалить все предупреждения')
            .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(false)))
        .addSubcommand(sub => sub.setName('showlist').setDescription('Показать предупреждения')
            .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
            const embed = createAlertEmbed('error', user, t.modNoPerms);
            return interaction.reply({ embeds: [embed] });
        }

        // ─── add ───
        if (sub === 'add') {
            const targetUser = interaction.options.getUser('user');
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                const embed = createAlertEmbed('error', user, t.modMemberNotFound);
                return interaction.reply({ embeds: [embed] });
            }
            if (member.id === user.id) {
                const embed = createAlertEmbed('error', user, t.modCantTargetSelf);
                return interaction.reply({ embeds: [embed] });
            }
            if (member.id === interaction.guild.ownerId) {
                const embed = createAlertEmbed('error', user, t.modCantTargetOwner);
                return interaction.reply({ embeds: [embed] });
            }

            const reason = interaction.options.getString('reason') ?? t.modNoReason;
            const warning = await addWarning(interaction.guildId, member.id, user.id, reason);

            await sendModlog(client, interaction.guild, {
                title: t.warnLog, color: MOD_COLORS.warn, t,
                target: `${member.user.tag} (${member.id})`,
                moderator: `${user.tag} (${user.id})`,
                reason,
                extra: [{ name: t.warningsTotal, value: `${warning.id}`, inline: true }],
            });

            const embed = createAlertEmbed('success', user, t.warnSuccess(member.user.tag, warning.id), {
                modStyle: true, targetUser: member.user, reason, t,
            });
            return interaction.reply({ embeds: [embed] });
        }

        // ─── remove ───
        if (sub === 'remove') {
            const targetUser = interaction.options.getUser('user');
            const id = interaction.options.getInteger('id');

            if (!await removeWarning(interaction.guildId, targetUser.id, id)) {
                const embed = createAlertEmbed('error', user, t.unwarnNotFound);
                return interaction.reply({ embeds: [embed] });
            }

            const reason = interaction.options.getString('reason') ?? t.modNoReason;
            await sendModlog(client, interaction.guild, {
                title: t.unwarnLog, color: MOD_COLORS.unwarn, t,
                target: `${targetUser.tag} (${targetUser.id})`,
                moderator: `${user.tag} (${user.id})`,
                reason,
                extra: [{ name: 'Номер', value: `#${id}`, inline: true }],
            });

            const embed = createAlertEmbed('success', user, t.unwarnSuccess(targetUser.tag, id), {
                modStyle: true, targetUser, reason, t,
            });
            return interaction.reply({ embeds: [embed] });
        }

        // ─── purge ───
        if (sub === 'purge') {
            const targetUser = interaction.options.getUser('user');
            const count = await clearWarnings(interaction.guildId, targetUser.id);
            if (count === 0) {
                const embed = createAlertEmbed('warning', user, t.warningsEmpty);
                return interaction.reply({ embeds: [embed] });
            }

            const reason = interaction.options.getString('reason') ?? t.modNoReason;
            await sendModlog(client, interaction.guild, {
                title: t.clearwarnsLog, color: MOD_COLORS.clearwarns, t,
                target: `${targetUser.tag} (${targetUser.id})`,
                moderator: `${user.tag} (${user.id})`,
                reason,
                extra: [{ name: 'Удалено', value: `${count}`, inline: true }],
            });

            const embed = createAlertEmbed('success', user, t.clearwarnsSuccess(targetUser.tag, count), {
                modStyle: true, targetUser, reason, t,
            });
            return interaction.reply({ embeds: [embed] });
        }

        // ─── showlist ───
        if (sub === 'showlist') {
            const targetUser = interaction.options.getUser('user');
            const list = await getWarnings(interaction.guildId, targetUser.id);
            if (list.length === 0) {
                const embed = createAlertEmbed('warning', user, t.warningsEmpty);
                return interaction.reply({ embeds: [embed] });
            }

            const lines = list.slice(-25).map(w => {
                const mod = client.users.cache.get(w.moderator_id);
                const modName = mod ? mod.tag : w.moderator_id;
                const date = `<t:${Math.floor(w.timestamp / 1000)}:d>`;
                return `#${w.id} — ${w.reason ?? t.modNoReason} (${modName}, ${date})`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`${t.warningsTitle}: ${targetUser.tag}`)
                .setDescription(lines.join('\n'))
                .addFields({ name: t.warningsTotal, value: `${list.length}`, inline: true })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    },
};