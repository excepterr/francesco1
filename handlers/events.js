const fs = require('fs');
const path = require('path');
const msgCache = require('../utils/messageCache');
const {
    Collection, MessageFlags, EmbedBuilder,
    ContainerBuilder, TextDisplayBuilder,
} = require('discord.js');
const config = require('../config.json');
const { getSettings, getDisabledCategories } = require('../utils/settings');
const { createAlertEmbed } = require('../utils/embeds');
const { handleAiMention } = require('../utils/aiMention');
const { sendLogEvent } = require('../utils/logging');

const SESSION_TIME = 60_000;
const LOG_COLOR = 0x2f3236;
const cooldowns = new Collection();

function disableComponentsInJson(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(disableComponentsInJson);
    if (Array.isArray(node.components)) {
        for (const child of node.components) {
            if ([2, 3, 5, 6, 7, 8].includes(child.type)) child.disabled = true;
            else disableComponentsInJson(child);
        }
    }
}

async function disableMessageComponents(client, channelId, messageId) {
    if (!channelId || !messageId) return;
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (!msg || !msg.components?.length) return;
        const json = msg.components.map(c => c.toJSON());
        json.forEach(disableComponentsInJson);
        const isV2 = msg.flags?.has(MessageFlags.IsComponentsV2);
        const payload = { components: json };
        if (isV2) payload.flags = MessageFlags.IsComponentsV2;
        await msg.edit(payload).catch(err => {
            if (err?.code !== 10008) console.error('disableMessageComponents:', err);
        });
    } catch (err) {
        if (err?.code !== 10008) console.error('disableMessageComponents:', err);
    }
}

function extractOwnerId(customId) {
    const parts = customId.split(':');
    const moduleId = parts[0];
    if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (/^\d{17,20}$/.test(last)) return { moduleId, ownerId: last };
    }
    return { moduleId, ownerId: null };
}

function findSessionByOwner(client, ownerId) {
    for (const s of client.sessions.values()) if (s.ownerId === ownerId) return s;
    return null;
}

async function registerSession(client, interaction, reply) {
    const session = {
        messageId: reply.id,
        channelId: reply.channelId,
        ownerId: interaction.user.id,
        expiresAt: Date.now() + SESSION_TIME,
    };
    client.sessions.set(reply.id, session);
    setTimeout(() => {
        const cur = client.sessions.get(reply.id);
        if (cur && Date.now() >= cur.expiresAt) {
            client.sessions.delete(reply.id);
            disableMessageComponents(client, cur.channelId, cur.messageId).catch(() => {});
        }
    }, SESSION_TIME + 500);
}

function wrapInteraction(interaction) {
    let finalMessage = null;
    const originalReply = interaction.reply.bind(interaction);
    const originalDefer = interaction.deferReply.bind(interaction);
    const originalEdit = interaction.editReply.bind(interaction);
    const originalFollowUp = interaction.followUp.bind(interaction);

    interaction.deferReply = async (opts = {}) => {
        if (interaction.deferred || interaction.replied) return;
        return originalDefer(opts);
    };

    interaction.reply = async (opts = {}) => {
        const wantsEph = !!(opts.flags & MessageFlags.Ephemeral);
        if (interaction.replied) return originalFollowUp(opts);
        if (interaction.deferred) {
            finalMessage = await originalEdit(opts);
            return finalMessage;
        }
        finalMessage = await originalReply(opts);
        return finalMessage;
    };

    interaction.getFinalMessage = () => finalMessage;
    return interaction;
}

function sanitize(s) {
    return String(s ?? '')
        .replace(/```/g, "'''")   // нельзя закрыть code-блок
        .slice(0, 900);
}

/**
 * @param {string} title       — «Сообщение удалено»
 * @param {string|null} user   — «username (id)» — для заголовка
 * @param {string|null} channelPing — «<#id>» — первая строка описания
 * @param {Array} fields       — [{ name, value }] → внутрь code-блока
 */
function logContainer(title, user, channelPing, fields = []) {
    const fullTitle = user ? `${title} — ${user}` : title;

    const container = new ContainerBuilder().setAccentColor(null);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${fullTitle}`),
    );

    const desc = [];
    if (channelPing) desc.push(channelPing);
    if (fields.length) {
        const text = fields
            .map(f => `${f.name}: ${sanitize(f.value)}`)
            .join('\n');
        desc.push('```\n' + text + '\n```');
    }
    if (desc.length) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(desc.join('\n')),
        );
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:f>`),
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    if (fs.existsSync(eventsPath)) {
        for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
            const event = require(path.join(eventsPath, file));
            client.on(event.name, (...args) => event.execute(client, ...args));
        }
    }

    function checkCooldown(userId, command) {
        const commandName = command.data?.name ?? command.name;
        if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Collection());
        const now = Date.now();
        const timestamps = cooldowns.get(commandName);
        const cooldownAmount = (command.cooldown || 6) * 1000;
        if (timestamps.has(userId)) {
            const exp = timestamps.get(userId) + cooldownAmount;
            if (now < exp) return ((exp - now) / 1000).toFixed(1);
        }
        timestamps.set(userId, now);
        setTimeout(() => timestamps.delete(userId), cooldownAmount);
        return false;
    }

    // ═══════════ MESSAGE CREATE ═══════════
    client.on('messageCreate', async (message) => {
        if (!message.guild) return;
        if (message.author.bot) { msgCache.remember(message); return; }
        msgCache.remember(message);

        if (message.author.id === config.ownerId) {
            const { prefix } = await getSettings(message.guildId);
            if (message.content.startsWith(prefix)) {
                const args = message.content.slice(prefix.length).trim().split(/\s+/);
                const commandName = args.shift().toLowerCase();
                const command = client.prefixCommands.get(commandName);
                if (command) {
                    try { await command.execute(client, message, args); }
                    catch (error) {
                        console.error(error);
                        message.reply({ content: `\`\`\`${String(error.message).slice(0, 1900)}\`\`\`` }).catch(() => {});
                    }
                    return;
                }
            }
        }

        if (message.mentions.users.has(client.user.id)) {
            handleAiMention(client, message).catch(err => console.error('AI mention error:', err));
        }
    });

    // ═══════════ INTERACTION CREATE ═══════════
    client.on('interactionCreate', async (interaction) => {

        // ─── SLASH ───
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command?.slashExecute) return;

            wrapInteraction(interaction);

            // ephemeral по умолчанию TRUE, кроме команд с ephemeral: false
            const isPublic = command.ephemeral === false;
            try {
                await interaction.deferReply(isPublic ? {} : { flags: MessageFlags.Ephemeral });
            } catch {}

            try {
                const { lang } = interaction.guildId
                    ? await getSettings(interaction.guildId).catch(() => ({ lang: 'ru' }))
                    : { lang: 'ru' };
                const t = client.locales?.[lang] ?? client.locales?.ru;

                const ALWAYS_ENABLED = ['edit'];
                const disabled = await getDisabledCategories(interaction.guildId).catch(() => []);
                const category = command.category ?? 'other';

                if (disabled.includes(category) && !ALWAYS_ENABLED.includes(command.data.name)) {
                    const embed = createAlertEmbed('warning', interaction.user,
                        t.categoryDisabled, { action: t.alertActionSettings });
                    return interaction.editReply({ embeds: [embed] });
                }

                const timeLeft = checkCooldown(interaction.user.id, command);
                if (timeLeft) {
                    const embed = createAlertEmbed('warning', interaction.user,
                        t.cooldownMessage(timeLeft), { action: t.alertActionCooldown });
                    return interaction.editReply({ embeds: [embed] });
                }

                await command.slashExecute(client, interaction);

                let reply = interaction.getFinalMessage?.();
                if (!reply) reply = await interaction.fetchReply().catch(() => null);
                if (reply && reply.components?.length) {
                    await registerSession(client, interaction, reply);
                }
            } catch (error) {
                console.error(error);
                try {
                    const { lang } = interaction.guildId
                        ? await getSettings(interaction.guildId).catch(() => ({ lang: 'ru' }))
                        : { lang: 'ru' };
                    const t = client.locales?.[lang] ?? client.locales?.ru ?? {};
                    const embed = createAlertEmbed('error', interaction.user, t.errorOccurred);
                    await interaction.editReply({ embeds: [embed] }).catch(err => {
                        if (err?.code !== 10008) console.error('[events] editReply failed:', err);
                    });
                } catch {}
            }
            return;
        }

        // ─── AUTOCOMPLETE ───
        if (interaction.isAutocomplete()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command?.autocompleteExecute) return;
            try { await command.autocompleteExecute(client, interaction); }
            catch (error) { console.error(error); }
            return;
        }

        // ─── COMPONENTS ───
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            const { lang } = interaction.guildId ? await getSettings(interaction.guildId) : { lang: 'ru' };
            const t = client.locales?.[lang] ?? client.locales?.ru;

            const { moduleId, ownerId: customOwnerId } = extractOwnerId(interaction.customId);
            const handler = client.components.get(moduleId);
            if (!handler) return;

            const messageId = interaction.message?.id ?? null;
            let session = messageId ? client.sessions.get(messageId) : null;
            if (!session && customOwnerId) session = findSessionByOwner(client, customOwnerId);

            const effectiveOwnerId = session?.ownerId ?? customOwnerId;
            if (effectiveOwnerId && effectiveOwnerId !== interaction.user.id) {
                const embed = createAlertEmbed('error', interaction.user, t.notOwner);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            if (session) {
                if (Date.now() > session.expiresAt) {
                    await disableMessageComponents(client, session.channelId, session.messageId);
                    client.sessions.delete(session.messageId);
                    const embed = createAlertEmbed('warning', interaction.user, t.sessionExpired);
                    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
                }
                session.expiresAt = Date.now() + SESSION_TIME;
            }

            try { await handler(client, interaction, session); }
            catch (error) { console.error(error); }
            return;
        }
    });

    // ═══════════ LOGGING ═══════════

    client.on('messageDelete', async (message) => {
        const cached = msgCache.get(message.channelId, message.id);
        const author = message.author ?? (cached?.author ? { ...cached.author } : null);
        const content = message.content || cached?.content || '';
        const attachments = message.attachments?.size
            ? [...message.attachments.values()]
            : (cached?.attachments ?? []);

        if (!author || author.bot) { msgCache.remove(message.channelId, message.id); return; }
        if (!content && !attachments.length) { msgCache.remove(message.channelId, message.id); return; }
        msgCache.remove(message.channelId, message.id);

        try {
            const { lang } = await getSettings(message.guildId);
            const t = client.locales[lang] ?? client.locales.ru;

            const fields = [
                { name: t.logFieldAuthor, value: `${author.tag} (${author.id})` },
                { name: t.logFieldContent, value: content || `(${t.logAttachmentOnly})` },
            ];
            if (attachments.length) {
                fields.push({
                    name: 'Attachments',
                    value: attachments.slice(0, 5).map(a => a.name ?? 'file').join(', '),
                });
            }

            const payload = logContainer(
                t.logEvtMessageDelete,
                author.tag,
                `<#${message.channelId}>`,
                fields,
            );
            await sendLogEvent(client, message.guild, 'message_delete', payload);
        } catch (e) { console.error(e); }
    });

    client.on('messageUpdate', async (oldMsg, newMsg) => {
        if (!newMsg.guild) return;
        const cached = msgCache.get(newMsg.channelId, newMsg.id);
        const author = newMsg.author ?? cached?.author ?? null;
        if (!author || author.bot) return;

        const oldContent = oldMsg.content ?? cached?.content ?? '';
        const newContent = newMsg.content ?? '';
        if (oldContent === newContent) return;
        if (newMsg.content !== undefined) msgCache.remember(newMsg);

        try {
            const { lang } = await getSettings(newMsg.guildId);
            const t = client.locales[lang] ?? client.locales.ru;

            const payload = logContainer(
                t.logEvtMessageEdit,
                author.tag,
                `<#${newMsg.channelId}>`,
                [
                    { name: t.logFieldBefore, value: oldContent || '—' },
                    { name: t.logFieldAfter, value: newContent || '—' },
                ],
            );
            await sendLogEvent(client, newMsg.guild, 'message_edit', payload);
        } catch (e) { console.error(e); }
    });

    client.on('messageDeleteBulk', async (messages, channel) => {
        if (!channel.guild) return;
        try {
            const { lang } = await getSettings(channel.guildId);
            const t = client.locales[lang] ?? client.locales.ru;

            const authorIds = new Set();
            for (const m of messages.values()) {
                const cached = msgCache.get(channel.id, m.id);
                const id = m.author?.id ?? cached?.author?.id;
                if (id) authorIds.add(id);
                msgCache.remove(channel.id, m.id);
            }
            const authors = [...authorIds].slice(0, 10).map(id => `<@${id}>`).join(', ') || '—';

            const payload = logContainer(
                t.logEvtMessageBulkDelete,
                null,
                `<#${channel.id}>`,
                [
                    { name: t.logFieldCount, value: `${messages.size}` },
                    { name: t.logFieldAuthor, value: authors },
                ],
            );
            await sendLogEvent(client, channel.guild, 'message_bulk_delete', payload);
        } catch (e) { console.error(e); }
    });

    client.on('guildMemberAdd', async (member) => {
        try {
            const { lang } = await getSettings(member.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;
            const ts = Math.floor(member.user.createdTimestamp / 1000);

            const payload = logContainer(
                t.logEvtMemberJoin,
                `${member.user.tag} (${member.id})`,
                null,
                [
                    { name: t.logFieldAccountCreated, value: `<t:${ts}:R>` },
                ],
            );
            await sendLogEvent(client, member.guild, 'member_join', payload);
        } catch (e) { console.error(e); }
    });

    client.on('guildMemberRemove', async (member) => {
        try {
            const { lang } = await getSettings(member.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;
            const joinedTs = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

            const fields = [];
            if (joinedTs) fields.push({ name: t.logFieldJoined, value: `<t:${joinedTs}:R>` });

            const payload = logContainer(
                t.logEvtMemberLeave,
                `${member.user.tag} (${member.id})`,
                null,
                fields,
            );
            await sendLogEvent(client, member.guild, 'member_leave', payload);
        } catch (e) { console.error(e); }
    });

    client.on('guildBanAdd', async (ban) => {
        try {
            const { lang } = await getSettings(ban.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;

            const payload = logContainer(
                t.logEvtMemberBan,
                `${ban.user.tag} (${ban.user.id})`,
                null,
                [{ name: t.logFieldReason, value: ban.reason || '—' }],
            );
            await sendLogEvent(client, ban.guild, 'member_ban', payload);
        } catch (e) { console.error(e); }
    });

    client.on('guildBanRemove', async (ban) => {
        try {
            const { lang } = await getSettings(ban.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;

            const payload = logContainer(
                t.logEvtMemberUnban,
                `${ban.user.tag} (${ban.user.id})`,
                null,
                [],
            );
            await sendLogEvent(client, ban.guild, 'member_unban', payload);
        } catch (e) { console.error(e); }
    });

    client.on('voiceStateUpdate', async (oldState, newState) => {
        const guild = newState.guild ?? oldState.guild;
        if (!guild) return;
        const member = newState.member ?? oldState.member;
        if (!member || member.user.bot) return;

        try {
            const { lang } = await getSettings(guild.id);
            const t = client.locales[lang] ?? client.locales.ru;
            const before = oldState.channelId;
            const after = newState.channelId;

            if (!before && after) {
                const payload = logContainer(t.logEvtVoiceJoin, member.user.tag, `<#${after}>`, []);
                await sendLogEvent(client, guild, 'voice_join', payload);
            } else if (before && !after) {
                const payload = logContainer(t.logEvtVoiceLeave, member.user.tag, `<#${before}>`, []);
                await sendLogEvent(client, guild, 'voice_leave', payload);
            } else if (before && after && before !== after) {
                const payload = logContainer(t.logEvtVoiceMove, member.user.tag, null, [
                    { name: t.logFieldVoiceBefore, value: `<#${before}>` },
                    { name: t.logFieldVoiceAfter, value: `<#${after}>` },
                ]);
                await sendLogEvent(client, guild, 'voice_move', payload);
            }
        } catch (e) { console.error(e); }
    });

    client.on('channelCreate', async (channel) => {
        if (!channel.guild) return;
        try {
            const { lang } = await getSettings(channel.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;

            const payload = logContainer(t.logEvtChannelCreate, `#${channel.name}`, null, [
                { name: t.logFieldId, value: channel.id },
            ]);
            await sendLogEvent(client, channel.guild, 'channel_create', payload);
        } catch (e) { console.error(e); }
    });

    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        try {
            const { lang } = await getSettings(channel.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;

            const payload = logContainer(t.logEvtChannelDelete, `#${channel.name ?? '—'}`, null, [
                { name: t.logFieldId, value: channel.id },
            ]);
            await sendLogEvent(client, channel.guild, 'channel_delete', payload);
        } catch (e) { console.error(e); }
    });

    client.on('roleCreate', async (role) => {
        if (!role.guild) return;
        try {
            const { lang } = await getSettings(role.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;

            const payload = logContainer(t.logEvtRoleCreate, role.name, null, [
                { name: t.logFieldId, value: role.id },
            ]);
            await sendLogEvent(client, role.guild, 'role_create', payload);
        } catch (e) { console.error(e); }
    });

    client.on('roleDelete', async (role) => {
        if (!role.guild) return;
        try {
            const { lang } = await getSettings(role.guild.id);
            const t = client.locales[lang] ?? client.locales.ru;

            const payload = logContainer(t.logEvtRoleDelete, role.name, null, [
                { name: t.logFieldId, value: role.id },
            ]);
            await sendLogEvent(client, role.guild, 'role_delete', payload);
        } catch (e) { console.error(e); }
    });
};