const {
    SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder,
    PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getSettings } = require('../../utils/settings');
const { createAlertEmbed } = require('../../utils/embeds');
const conf = require('../../utils/confessions');
const config = require('../../config.json');

const OWNER_ID = config.ownerId;
const TITLE = (t) => t.confPanelTitle ?? 'Контейнеры памяти ИИ';

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

function buildContainer(content, title) {
    const c = new ContainerBuilder().setAccentColor(null);
    if (title) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return c;
}

function buildConfirmContainer(user, container, content, t) {
    const c = new ContainerBuilder().setAccentColor(null);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`conf_block_confirm:${container.id}`).setLabel(t.confBtnConfirm ?? 'Подтвердить').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`conf_block_cancel:${container.id}`).setLabel(t.confBtnCancel ?? 'Отмена').setStyle(ButtonStyle.Secondary),
    );
    c.addActionRowComponents(row);

    const ts = Math.floor(Date.now() / 1000);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`));
    return c;
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('confessions')
        .setDescription('Управление контейнерами памяти ИИ')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('create')
            .setDescription('Создать контейнер памяти для канала')
            .addChannelOption(o => o.setName('channel').setDescription('Канал').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('Список контейнеров сервера'))
        .addSubcommand(sub => sub.setName('block')
            .setDescription('Удалить контейнер безвозвратно')
            .addStringOption(o => o.setName('id').setDescription('ID контейнера').setRequired(true)))
        .addSubcommand(sub => sub.setName('report')
            .setDescription('Отправить контейнер владельцу бота')
            .addStringOption(o => o.setName('id').setDescription('ID контейнера').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Причина репорта').setRequired(true))),

    slashExecute: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { lang } = await getSettings(interaction.guildId);
        const t = client.locales[lang] ?? client.locales.ru;
        const user = interaction.user;

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = createAlertEmbed('error', user, t.confNoAdmin, { action: t.alertActionConfessions });
            return interaction.reply({ embeds: [embed] });
        }

        // ─── create ───
        if (sub === 'create') {
            const channel = interaction.options.getChannel('channel');
            if (!channel.isTextBased()) {
                const embed = createAlertEmbed('error', user, t.confNotText, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }

            try {
                const data = await conf.createContainer(interaction.guildId, channel.id, user.id);
                const container = buildContainer(
                    `${user}, ${t.confCreated(channel.toString())}\n\`\`\`\nID: ${data.id}\n\`\`\``,
                );
                const ts = Math.floor(Date.now() / 1000);
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`));
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            } catch (err) {
                const msg = err.message === 'MAX_CONTAINERS'
                    ? t.confMaxContainers(conf.MAX_CONTAINERS_PER_GUILD)
                    : err.message === 'MAX_SIZE'
                    ? t.confMaxSize(formatSize(conf.MAX_SIZE_PER_GUILD))
                    : t.confUnknownError;
                const embed = createAlertEmbed('error', user, msg, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }
        }

        // ─── list ───
        if (sub === 'list') {
            const list = await conf.listContainers(interaction.guildId);
            if (!list.length) {
                const embed = createAlertEmbed('warning', user, t.confNoContainers, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }

            const lines = list.map((c, i) => {
                const ch = interaction.guild.channels.cache.get(c.channel_id);
                const chName = ch ? `#${ch.name}` : `\`${c.channel_id}\``;
                return `${i + 1}. ${chName}\n    \`${c.id}\` — ${formatSize(c.size_bytes || 0)} / 30.00 МБ`;
            });

            const container = buildContainer(lines.join('\n'), TITLE(t));
            const ts = Math.floor(Date.now() / 1000);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`));
            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // ─── block ───
        if (sub === 'block') {
            const id = interaction.options.getString('id');
            const container = await conf.getContainerById(interaction.guildId, id);
            if (!container) {
                const embed = createAlertEmbed('error', user, t.confNotFound, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }

            const content = `${user}, ${t.confConfirmDelete ?? 'Вы **уверены**, что хотите безвозвратно удалить контейнер?'}\n\`\`\`\nID: ${id}\n${container.message_count || 0} msg / ${formatSize(container.size_bytes || 0)} / ${container.message_count || 0} users\n\`\`\``;
            const conf_container = buildConfirmContainer(user, container, content, t);

            return interaction.reply({ components: [conf_container], flags: MessageFlags.IsComponentsV2 });
        }

        // ─── report ───
        if (sub === 'report') {
            const id = interaction.options.getString('id');
            const reason = interaction.options.getString('reason');

            const container = await conf.getContainerById(interaction.guildId, id);
            if (!container) {
                const embed = createAlertEmbed('error', user, t.confNotFound, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }

            await interaction.deferReply();

            const data = await conf.readContainer(interaction.guildId, id);
            const owner = await client.users.fetch(OWNER_ID).catch(() => null);
            if (!owner) {
                const embed = createAlertEmbed('error', user, t.confUnknownError, { action: t.alertActionConfessions });
                return interaction.editReply({ embeds: [embed] });
            }

            const json = JSON.stringify(data, null, 2);
            const attachment = new AttachmentBuilder(Buffer.from(json, 'utf-8'), { name: `container-${id}.json` });

            const ch = interaction.guild.channels.cache.get(container.channel_id);
            const usersCount = Object.keys(data?.memory ?? {}).length;

            const header = new EmbedBuilder()
                .setTitle(id)
                .setDescription([
                    '```',
                    `guild: ${interaction.guild.name} (${interaction.guildId})`,
                    `channel id: ${container.channel_id} — ${user.username} (${user.id})`,
                    `reason: ${reason}`,
                    '',
                    'message / size / users:',
                    `${container.message_count || 0} / ${formatSize(container.size_bytes || 0)} / ${usersCount}`,
                    '```',
                ].join('\n'))
                .setTimestamp();

            await owner.send({ embeds: [header], files: [attachment] });

            const replyContainer = buildContainer(
                `${user}, ${t.confReported2}\n\`\`\`\nID container: ${id}\n\`\`\``,
            );
            const ts = Math.floor(Date.now() / 1000);
            replyContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`));

            return interaction.editReply({ components: [replyContainer], flags: MessageFlags.IsComponentsV2 });
        }
    },

    components: {
        // подтверждение удаления
        conf_block_confirm: async (client, interaction) => {
            const id = interaction.customId.split(':')[1];
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;

            const container = await conf.getContainerById(interaction.guildId, id);
            if (!container) {
                const embed = createAlertEmbed('error', interaction.user, t.confNotFound, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }

            await conf.deleteContainer(interaction.guildId, id);

            const reply = buildContainer(
                `${interaction.user}, ${t.confBlocked2}\n\`\`\`\nID container: ${id}\n\`\`\``,
            );
            const ts = Math.floor(Date.now() / 1000);
            reply.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`));

            return interaction.update({ components: [reply], flags: MessageFlags.IsComponentsV2 });
        },

        conf_block_cancel: async (client, interaction) => {
            return interaction.message.delete().catch(() => {});
        },

        conf_regen: async (client, interaction) => {
            const userId = interaction.customId.split(':')[1];
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;

            if (userId !== interaction.user.id) {
                const embed = createAlertEmbed('error', interaction.user, t.confRegenNotOwner, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }

            const ctx = client.regenData?.get(interaction.message.id);
            if (!ctx) {
                const embed = createAlertEmbed('error', interaction.user, t.confRegenExpired, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }
            if (ctx.attempts >= 3) {
                const embed = createAlertEmbed('warning', interaction.user, t.confRegenLimit, { action: t.alertActionConfessions });
                return interaction.reply({ embeds: [embed] });
            }

            await interaction.deferUpdate();

            const { askAI } = require('../../utils/ai');
            const { buildReplyContainer } = require('../../utils/aiMention');

            const reply = await askAI({
                messages: ctx.messages, memory: ctx.memory,
                userId: ctx.userId, botName: ctx.botName,
                onSaveFact: async (fact) => conf.saveFact(ctx.guildId, ctx.containerId, ctx.userId, ctx.username, fact),
            });

            if (!reply || reply === '__RATE_LIMIT__') {
                const embed = createAlertEmbed('error', interaction.user,
                    reply === '__RATE_LIMIT__' ? t.confRegenRateLimit : t.confRegenFailed,
                    { action: t.alertActionConfessions });
                return interaction.followUp({ embeds: [embed] });
            }

            ctx.attempts += 1;
            await conf.replaceLastAssistant(ctx.guildId, ctx.containerId, reply);

            const disabled = ctx.attempts >= 3;
            const { container, actions } = buildReplyContainer(reply, userId, disabled);
            return interaction.editReply({ components: [container, actions], flags: MessageFlags.IsComponentsV2 });
        },

        conf_report_msg: async (client, interaction) => {
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const modal = new ModalBuilder()
                .setCustomId(`conf_report_modal:${interaction.user.id}`)
                .setTitle('Report')
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('reason_input')
                        .setLabel(t.confReportReasonLabel ?? 'Причина репорта')
                        .setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)
                ));
            return interaction.showModal(modal);
        },

        conf_report_modal: async (client, interaction) => {
            const { lang } = await getSettings(interaction.guildId);
            const t = client.locales[lang] ?? client.locales.ru;
            const user = interaction.user;
            const reason = interaction.fields.getTextInputValue('reason_input').trim();

            await interaction.deferReply();

            const container = await conf.getContainerByChannel(interaction.guildId, interaction.channelId);
            if (!container) {
                const embed = createAlertEmbed('error', user, t.confNotFound, { action: t.alertActionConfessions });
                return interaction.editReply({ embeds: [embed] });
            }

            const data = await conf.readContainer(interaction.guildId, container.id);
            const owner = await client.users.fetch(OWNER_ID).catch(() => null);
            if (!owner) {
                const embed = createAlertEmbed('error', user, t.confUnknownError, { action: t.alertActionConfessions });
                return interaction.editReply({ embeds: [embed] });
            }

            const msgRef = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${interaction.message.id}`;
            const originalReply = interaction.message?.components?.[0]?.components?.[0]?.content ?? '—';

            const json = JSON.stringify(data, null, 2);
            const attachment = new AttachmentBuilder(Buffer.from(json, 'utf-8'), { name: `container-${container.id}.json` });

            const header = new EmbedBuilder()
                .setTitle(container.id)
                .setDescription([
                    '```',
                    `guild: ${interaction.guild.name} (${interaction.guildId})`,
                    `channel id: ${interaction.channelId} — ${user.username} (${user.id})`,
                    `reason: ${reason}`,
                    '',
                    `msg: ${msgRef}`,
                    `reply: ${String(originalReply).slice(0, 200)}`,
                    '```',
                ].join('\n'))
                .setTimestamp();

            await owner.send({ embeds: [header], files: [attachment] });

            const reply = buildContainer(`${user}, ${t.confReported2}\n\`\`\`\nID container: ${container.id}\n\`\`\``);
            const ts = Math.floor(Date.now() / 1000);
            reply.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`));
            return interaction.editReply({ components: [reply], flags: MessageFlags.IsComponentsV2 });
        },
    },
};