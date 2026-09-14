const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const { MOD_COLORS, sendModlog } = require('../../utils/moderation');

module.exports = {
    cooldown: 10,
    ephemeral: false,
    botPermissions: ['Банить участников', 'Встраивать ссылки'],
    data: new SlashCommandBuilder()
        .setName('unbanall')
        .setDescription('Разблокировать всех заблокированных')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(o => o.setName('reason').setDescription('Причина')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.modNoPerms)] });
        }

        const bans = await interaction.guild.bans.fetch();
        if (bans.size === 0) {
            return interaction.editReply({ embeds: [createAlertEmbed('warning', user, t.unbanallNoBans)] });
        }

        const reason = interaction.options.getString('reason') ?? t.modNoReason;

        const unbanned = [];
        let failed = 0;
        for (const ban of bans.values()) {
            try {
                await interaction.guild.members.unban(ban.user.id, `[UnbanAll] ${reason} | ${user.tag}`);
                unbanned.push({ tag: ban.user.tag, id: ban.user.id, reason: ban.reason ?? t.modNoReason });
            } catch { failed++; }
        }

        await sendModlog(client, interaction.guild, {
            title: t.unbanallLog, color: MOD_COLORS.unban, t,
            target: `— (${bans.size})`,
            moderator: `${user.tag} (${user.id})`,
            reason,
            extra: [{ name: 'OK', value: `${unbanned.length}`, inline: true }],
        });

        const list = unbanned.slice(0, 50)
            .map((u, i) => `${i + 1}. ${u.tag} (${u.id}) | ${u.reason}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle(t.unbanallSuccess(unbanned.length))
            .setDescription('```\n' + (list || '—') + '\n```')
            .setTimestamp();

        if (failed) embed.setFooter({ text: `Failed: ${failed}` });

        return interaction.editReply({ embeds: [embed] });
    },
};