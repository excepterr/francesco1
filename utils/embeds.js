const { EmbedBuilder } = require('discord.js');

const DEFAULT_TITLES = {
    error:   'Ошибка',
    warning: 'Внимание',
    success: 'Успешно',
};

function createAlertEmbed(type, user, text, options = {}) {
    const embed = new EmbedBuilder().setTimestamp();

    // mod-стиль: заголовок — действие + username цели
    if (options.modStyle && options.targetUser) {
        const titleText = options.t?.modInteractionTitle ?? 'Взаимодействие с участником';
        embed.setTitle(`${titleText} — ${options.targetUser.username}`);
        const reasonText = options.reason ?? (options.t?.modNoReason ?? 'Не указана');
        embed.setDescription(`${user}, ${text}\n\n> ${options.t?.modFieldReason ?? 'Причина'}: ${reasonText}`);
        if (options.targetUser.displayAvatarURL) {
            embed.setThumbnail(options.targetUser.displayAvatarURL({ size: 256 }));
        }
        return embed;
    }

    // обычный алерт
    embed.setDescription(`${user}, ${text}`);
    embed.setThumbnail(
        options.thumbnail === null
            ? null
            : (options.thumbnail ?? user.displayAvatarURL({ size: 256 }))
    );

    // заголовок ВСЕГДА с « — username»
    const baseTitle =
        options.action ??
        options.title ??
        (DEFAULT_TITLES[type] ?? 'Уведомление');

    embed.setTitle(`${baseTitle} — ${user.username}`);

    return embed;
}

async function replyAlert(message, type, text, options = {}) {
    const embed = createAlertEmbed(type, message.author, text, options);
    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
}

module.exports = { createAlertEmbed, replyAlert };