const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');

const NEKOS_URL = 'https://nekos.best/api/v2';

const ACTIONS = {
    hug:      { target: true,  label: 'Обнять' },
    kiss:     { target: true,  label: 'Поцеловать' },
    slap:     { target: true,  label: 'Шлепнуть' },
    pat:      { target: true,  label: 'Погладить' },
    cuddle:   { target: true,  label: 'Прижаться' },
    poke:     { target: true,  label: 'Ткнуть' },
    tickle:   { target: true,  label: 'Пощекотать' },
    punch:    { target: true,  label: 'Ударить' },
    bite:     { target: true,  label: 'Укусить' },
    highfive: { target: true,  label: 'Дать пять' },
    handhold: { target: true,  label: 'Держаться за руки' },
    feed:     { target: true,  label: 'Покормить' },
    cry:      { target: false, label: 'Плакать' },
    laugh:    { target: false, label: 'Смеяться' },
    dance:    { target: false, label: 'Танцевать' },
    wave:     { target: false, label: 'Помахать' },
    blush:    { target: false, label: 'Краснеть' },
    smile:    { target: false, label: 'Улыбаться' },
    wink:     { target: false, label: 'Подмигнуть' },
    facepalm: { target: false, label: 'Фейспалм' },
    thumbsup: { target: false, label: 'Палец вверх' },
    smug:     { target: false, label: 'Самодовольный' },
};

async function fetchGif(action) {
    try {
        const res = await fetch(`${NEKOS_URL}/${action}?amount=1`, {
            headers: { 'User-Agent': 'DiscordBot/1.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.results?.[0]?.url ?? null;
    } catch { return null; }
}

function renderText(tpl, user, target) {
    return tpl.replace(/{user}/g, `<@${user.id}>`).replace(/{target}/g, target ? `<@${target.id}>` : '');
}

module.exports = {
    cooldown: 3,
    ephemeral: false,
    data: new SlashCommandBuilder()
        .setName('actions')
        .setDescription('Эмоции и взаимодействия с гифками')
        .addStringOption(o => o.setName('action').setDescription('Что сделать').setRequired(true)
            .addChoices(...Object.entries(ACTIONS).map(([value, m]) => ({ name: m.label, value }))))
        .addUserOption(o => o.setName('user').setDescription('Пользователь')),

    slashExecute: async (client, interaction) => {
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        const actionKey = interaction.options.getString('action');
        const meta = ACTIONS[actionKey];
        if (!meta) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.actionsUnknown)] });

        const target = interaction.options.getUser('user') || null;
        if (meta.target && !target) {
            return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.actionsTargetRequired)] });
        }

        const tpl = t.actionsList?.[actionKey];
        if (!tpl) return interaction.editReply({ embeds: [createAlertEmbed('error', user, t.actionsUnknown)] });

        const description = renderText(meta.target ? tpl.other : tpl.self, user, target);
        const gifURL = await fetchGif(actionKey);

        const embed = new EmbedBuilder().setDescription(description);
        if (gifURL) embed.setImage(gifURL);
        else embed.setFooter({ text: t.actionsNoGif });

        return interaction.editReply({
            embeds: [embed],
            allowedMentions: { parse: [], users: [user.id, ...(target ? [target.id] : [])] },
        });
    },
};