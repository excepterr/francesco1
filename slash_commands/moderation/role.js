const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 4,
    botPermissions: ['Управление ролями', 'Встраивать ссылки'],

    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Управление ролями участников')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub => sub.setName('add').setDescription('Выдать роль')
            .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Роль').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(false)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Снять роль')
            .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Роль').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(false))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = createAlertEmbed('error', user, t.modNoPerms);
            return interaction.reply({ embeds: [embed] });
        }

        const targetUser = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');

        if (role.managed) {
            const embed = createAlertEmbed('error', user, t.modRoleManaged);
            return interaction.reply({ embeds: [embed] });
        }
        if (role.id === interaction.guild.id) {
            const embed = createAlertEmbed('error', user, t.modRoleEveryone);
            return interaction.reply({ embeds: [embed] });
        }

        const me = interaction.guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = createAlertEmbed('error', user, t.modBotNoPerms);
            return interaction.reply({ embeds: [embed] });
        }
        if (me.roles.highest.position <= role.position) {
            const embed = createAlertEmbed('error', user, t.modHierarchyBot);
            return interaction.reply({ embeds: [embed] });
        }
        if (user.id !== interaction.guild.ownerId && interaction.member.roles.highest.position <= role.position) {
            const embed = createAlertEmbed('error', user, t.modHierarchyUser);
            return interaction.reply({ embeds: [embed] });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            const embed = createAlertEmbed('error', user, t.modMemberNotFound);
            return interaction.reply({ embeds: [embed] });
        }

        const reason = interaction.options.getString('reason') ?? t.modNoReason;

        if (sub === 'add') {
            if (member.roles.cache.has(role.id)) {
                const embed = createAlertEmbed('warning', user, t.addroleAlready);
                return interaction.reply({ embeds: [embed] });
            }
            await member.roles.add(role, `${reason} | ${user.tag}`);
            await sendModlog(client, interaction.guild, {
                title: t.addroleLog, color: MOD_COLORS.addrole, t,
                target: `${member.user.tag} (${member.id})`,
                moderator: `${user.tag} (${user.id})`,
                reason,
                extra: [{ name: 'Роль', value: `${role}`, inline: true }],
            });
            const embed = createAlertEmbed('success', user, t.addroleSuccess(member.user.tag, role.name), {
                modStyle: true, targetUser: member.user, reason, t,
            });
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'remove') {
            if (!member.roles.cache.has(role.id)) {
                const embed = createAlertEmbed('warning', user, t.removeroleMissing);
                return interaction.reply({ embeds: [embed] });
            }
            await member.roles.remove(role, `${reason} | ${user.tag}`);
            await sendModlog(client, interaction.guild, {
                title: t.removeroleLog, color: MOD_COLORS.removerole, t,
                target: `${member.user.tag} (${member.id})`,
                moderator: `${user.tag} (${user.id})`,
                reason,
                extra: [{ name: 'Роль', value: `${role}`, inline: true }],
            });
            const embed = createAlertEmbed('success', user, t.removeroleSuccess(member.user.tag, role.name), {
                modStyle: true, targetUser: member.user, reason, t,
            });
            return interaction.reply({ embeds: [embed] });
        }
    },
};