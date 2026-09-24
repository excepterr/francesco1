import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    AttachmentBuilder,
} from 'discord.js';
import { MyClient } from '../../client';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import * as conf from '../../lib/confessions';
import { buildReplyActions } from '../../lib/aiMention';

const OWNER_ID = process.env.OWNER_ID ?? '';

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function buildContainer(title: string | null, content: string): ContainerBuilder {
    const c = new ContainerBuilder().setAccentColor(null);
    if (title) {
        c.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${title}`),
        );
    }
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return c;
}

export default {
    data: new SlashCommandBuilder()
        .setName('confessions')
        .setDescription('Manage AI memory containers.')
        .setDescriptionLocalizations(
            getLocalizations('commands.confessions.description'),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub
                .setName('create')
                .setDescription('Create an AI memory container for a channel.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.confessions.create.description'),
                )
                .addChannelOption((opt) =>
                    opt
                        .setName('channel')
                        .setDescription('The channel.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.confessions.create.option'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('list')
                .setDescription('List containers of the server.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.confessions.list.description'),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('block')
                .setDescription('Delete a container permanently.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.confessions.block.description'),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('id')
                        .setDescription('Container ID.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.confessions.block.option'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('report')
                .setDescription('Report a container to the bot owner.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.confessions.report.description'),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('id')
                        .setDescription('Container ID.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.confessions.report.idOption'),
                        ),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('reason')
                        .setDescription('Reason for the report.')
                        .setRequired(true)
                        .setDescriptionLocalizations(
                            getLocalizations('commands.confessions.report.reasonOption'),
                        ),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;
        const user = interaction.user;

        // ============ CREATE ============
        if (sub === 'create') {
            const channel = interaction.options.getChannel('channel', true);
            if (!channel.isTextBased()) {
                throw new UserError(t(lang, 'confessions.notText'));
            }

            try {
                const data = await conf.createContainer(guildId, channel.id, user.id);
                const container = buildContainer(
                    t(lang, 'confessions.create.title'),
                    t(lang, 'confessions.create.success', {
                        channel: `<#${channel.id}>`,
                        id: data.id,
                    }),
                );
                const ts = Math.floor(Date.now() / 1000);
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`),
                );
                await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 as number,
                });
                return;
            } catch (err: any) {
                const msg =
                    err.message === 'MAX_CONTAINERS'
                        ? t(lang, 'confessions.maxContainers', {
                              max: conf.MAX_CONTAINERS_PER_GUILD,
                          })
                        : err.message === 'MAX_SIZE'
                        ? t(lang, 'confessions.maxSize', {
                              size: formatSize(conf.MAX_SIZE_PER_GUILD),
                          })
                        : t(lang, 'confessions.unknownError');
                throw new UserError(msg);
            }
        }

        // ============ LIST ============
        if (sub === 'list') {
            const list = await conf.listContainers(guildId);
            if (!list.length) throw new UserError(t(lang, 'confessions.noContainers'));

            const lines = list.map((c, i) => {
                const ch = interaction.guild!.channels.cache.get(c.channel_id);
                const chName = ch ? `#${ch.name}` : `\`${c.channel_id}\``;
                return `${i + 1}. ${chName}\n    \`${c.id}\` — ${formatSize(c.size_bytes || 0)}`;
            });

            const container = buildContainer(
                t(lang, 'confessions.list.title'),
                lines.join('\n'),
            );
            const ts = Math.floor(Date.now() / 1000);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# <t:${ts}:f>`),
            );

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 as number,
            });
            return;
        }

        // ============ BLOCK ============
        if (sub === 'block') {
            const id = interaction.options.getString('id', true);
            const containerData = await conf.getContainerById(guildId, id);
            if (!containerData) throw new UserError(t(lang, 'confessions.notFound'));

            const c = new ContainerBuilder().setAccentColor(null);
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    t(lang, 'confessions.block.confirm', {
                        user: `<@${user.id}>`,
                        id,
                        count: containerData.message_count || 0,
                        size: formatSize(containerData.size_bytes || 0),
                    }),
                ),
            );

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`conf_block_confirm:${id}`)
                    .setLabel(t(lang, 'confessions.block.confirmBtn'))
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`conf_block_cancel:${id}`)
                    .setLabel(t(lang, 'confessions.block.cancelBtn'))
                    .setStyle(ButtonStyle.Secondary),
            );
            c.addActionRowComponents(row);

            await interaction.editReply({
                components: [c],
                flags: MessageFlags.IsComponentsV2 as number,
            });
            return;
        }

        // ============ REPORT ============
        if (sub === 'report') {
            const id = interaction.options.getString('id', true);
            const reason = interaction.options.getString('reason', true);

            const containerData = await conf.getContainerById(guildId, id);
            if (!containerData) throw new UserError(t(lang, 'confessions.notFound'));

            const data = await conf.readContainer(guildId, id);
            const owner = await interaction.client.users
                .fetch(OWNER_ID)
                .catch(() => null);
            if (!owner) throw new UserError(t(lang, 'confessions.unknownError'));

            const json = JSON.stringify(data, null, 2);
            const attachment = new AttachmentBuilder(Buffer.from(json, 'utf-8'), {
                name: `container-${id}.json`,
            });

            const header = new EmbedBuilder()
                .setTitle(id)
                .setDescription(
                    [
                        '```',
                        `guild: ${interaction.guild!.name} (${guildId})`,
                        `channel id: ${containerData.channel_id} — ${user.username} (${user.id})`,
                        `reason: ${reason}`,
                        '',
                        'message / size:',
                        `${containerData.message_count || 0} / ${formatSize(containerData.size_bytes || 0)}`,
                        '```',
                    ].join('\n'),
                )
                .setTimestamp();

            await owner
                .send({ embeds: [header], files: [attachment] })
                .catch(() => {});

            const reply = buildContainer(
                t(lang, 'confessions.report.title'),
                t(lang, 'confessions.report.success', { id }),
            );
            await interaction.editReply({
                components: [reply],
                flags: MessageFlags.IsComponentsV2 as number,
            });
        }
    },

    // ============ КНОПКИ И МОДАЛКИ ============
    components: {
        conf_block_confirm: async (
            _client: MyClient,
            interaction: MessageComponentInteraction,
        ) => {
            const id = interaction.customId.split(':')[1];
            const lang = getUserLanguage(interaction as any);

            const containerData = await conf.getContainerById(
                interaction.guildId!,
                id,
            );
            if (!containerData) {
                await interaction.reply({
                    content: t(lang, 'confessions.notFound'),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await conf.deleteContainer(interaction.guildId!, id);

            const reply = buildContainer(
                t(lang, 'confessions.block.title'),
                t(lang, 'confessions.block.success', { id }),
            );
            await interaction.update({
                components: [reply],
                flags: MessageFlags.IsComponentsV2 as number,
            });
        },

        conf_block_cancel: async (
            _client: MyClient,
            interaction: MessageComponentInteraction,
        ) => {
            await interaction.message.delete().catch(() => {});
        },

        conf_regen: async (
            client: MyClient,
            interaction: MessageComponentInteraction,
        ) => {
            const userId = interaction.customId.split(':')[1];
            const lang = getUserLanguage(interaction as any);

            if (userId !== interaction.user.id) {
                await interaction.reply({
                    content: t(lang, 'components.notOwner'),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const ctx = client.regenData.get(interaction.message.id);
            if (!ctx) {
                await interaction.reply({
                    content: t(lang, 'confessions.regen.expired'),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            if (ctx.attempts >= 3) {
                await interaction.reply({
                    content: t(lang, 'confessions.regen.limit'),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await interaction.deferUpdate();

            const { askAI } = await import('../../lib/ai');

            const reply = await askAI({
                messages: ctx.messages,
                memory: ctx.memory,
                userId: ctx.userId,
                botName: ctx.botName,
                onSaveFact: async (fact) =>
                    conf.saveFact(
                        ctx.guildId,
                        ctx.containerId,
                        ctx.userId,
                        ctx.username,
                        fact,
                    ),
            });

            if (!reply || reply === '__RATE_LIMIT__') {
                await interaction.followUp({
                    content:
                        reply === '__RATE_LIMIT__'
                            ? t(lang, 'confessions.regen.rateLimit')
                            : t(lang, 'confessions.regen.failed'),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            ctx.attempts += 1;
            await conf.replaceLastAssistant(ctx.guildId, ctx.containerId, reply);

            const disabled = ctx.attempts >= 3;
            const actions = buildReplyActions(userId, disabled);

            await interaction.editReply({
                content: reply,
                components: [actions],
            });
        },

        conf_report_msg: async (
            _client: MyClient,
            interaction: MessageComponentInteraction,
        ) => {
            const lang = getUserLanguage(interaction as any);

            const modal = new ModalBuilder()
                .setCustomId(`conf_report_modal:${interaction.user.id}`)
                .setTitle('Report')
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('reason_input')
                            .setLabel(t(lang, 'confessions.report.reasonLabel'))
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(500)
                            .setRequired(true),
                    ),
                );
            await interaction.showModal(modal);
        },

        conf_report_modal: async (
            client: MyClient,
            interaction: ModalSubmitInteraction,
        ) => {
            const lang = getUserLanguage(interaction as any);
            const user = interaction.user;
            const reason = interaction.fields
                .getTextInputValue('reason_input')
                .trim();

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const containerData = await conf.getContainerByChannel(
                interaction.guildId!,
                interaction.channelId,
            );
            if (!containerData) {
                await interaction.editReply({
                    content: t(lang, 'confessions.notFound'),
                });
                return;
            }

            const data = await conf.readContainer(
                interaction.guildId!,
                containerData.id,
            );
            const owner = await client.users.fetch(OWNER_ID).catch(() => null);
            if (!owner) {
                await interaction.editReply({
                    content: t(lang, 'confessions.unknownError'),
                });
                return;
            }

            const msgRef = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${interaction.message?.id}`;
            const json = JSON.stringify(data, null, 2);
            const attachment = new AttachmentBuilder(Buffer.from(json, 'utf-8'), {
                name: `container-${containerData.id}.json`,
            });

            const header = new EmbedBuilder()
                .setTitle(String(containerData.id))
                .setDescription(
                    [
                        '```',
                        `guild: ${interaction.guild!.name} (${interaction.guildId})`,
                        `channel id: ${interaction.channelId} — ${user.username} (${user.id})`,
                        `reason: ${reason}`,
                        `msg: ${msgRef}`,
                        '```',
                    ].join('\n'),
                )
                .setTimestamp();

            await owner
                .send({ embeds: [header], files: [attachment] })
                .catch(() => {});

            await interaction.editReply({
                content: t(lang, 'confessions.report.success', {
                    id: containerData.id,
                }),
            });
        },
    },
};