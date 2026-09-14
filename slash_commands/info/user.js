const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const COLOR = 0x2f3236;

module.exports = {
    cooldown: 5,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Информация о пользователе')
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Информация о пользователе')
                .addUserOption(o => o.setName('member').setDescription('Выберите пользователя (по умолчанию ваш)'))
        ),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (sub === 'info') {
            const target = interaction.options.getUser('member') || user;
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member) {
                const embed = createAlertEmbed('error', user, t.userInfoNotInGuild, {
                    action: t.alertActionUser,
                    thumbnail: target.displayAvatarURL({ size: 256 }),
                });
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const avatarURL = target.displayAvatarURL({ size: 512 });
            const joinedTs = Math.floor(member.joinedTimestamp / 1000);
            const createdTs = Math.floor(target.createdTimestamp / 1000);
            const roles = member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`)
                .join(' ') || (t.userInfoNoRoles ?? 'нет ролей');

            const embed = new EmbedBuilder()
                .setTitle(t.userInfoTitle(target.username, target.id) ?? `${target.username} (Id: ${target.id})`)
                .setURL(avatarURL)
                .setThumbnail(avatarURL)
                .addFields(
                    { name: t.userInfoJoined ?? 'Присоединился', value: `<t:${joinedTs}:f>\n(<t:${joinedTs}:R>)`, inline: true },
                    { name: t.userInfoCreated ?? 'Аккаунт создан', value: `<t:${createdTs}:f>\n(<t:${createdTs}:R>)`, inline: true },
                    { name: t.userInfoRoles ?? 'Роли', value: roles },
                )
                .setColor(COLOR)
                .setFooter({ text: `${t.request ?? 'Запрос от'} ${user.username}`, iconURL: user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } });
        }
    },
};