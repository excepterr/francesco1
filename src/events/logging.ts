import {
    Message,
    PartialMessage,
    Collection,
    GuildMember,
    PartialGuildMember,
    GuildBasedChannel,
    DMChannel,
    Role,
    GuildBan,
    VoiceState,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} from 'discord.js';
import { MyClient } from '../client';
import { sendLogEvent } from '../lib/logging';

function formatTs(ts: number | null | undefined): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Хелпер: собирает контейнер в едином стиле
function buildLogContainer(title: string, channelId: string | null, body: string): ContainerBuilder {
    const container = new ContainerBuilder().setAccentColor(null);

    // Заголовок
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${title}**`),
    );

    // Канал (кликабельный, обычным текстом)
    if (channelId) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`<#${channelId}>`),
        );
    }

    // Тело в ```text```
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('```text\n' + body + '\n```'),
    );

    return container;
}

// ============ MESSAGE DELETE ============
async function onMessageDelete(message: Message | PartialMessage) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const client = message.client as MyClient;
    const author = message.author;

    const content = message.content?.slice(0, 1500) ?? '*нет в кеше*';
    const attachments = message.attachments.size
        ? message.attachments.map((a) => a.name).join(', ').slice(0, 500)
        : null;

    const lines = [
        `Автор: ${author?.username ?? 'unknown'} (${author?.id ?? '—'})`,
        `Содержимое: ${content}`,
    ];
    if (attachments) lines.push(`Вложения: ${attachments}`);

    const container = buildLogContainer(
        `Сообщение удалено — ${author?.username ?? 'unknown'}`,
        message.channelId,
        lines.join('\n'),
    );

    await sendLogEvent(client, message.guild, 'message_delete', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ MESSAGE UPDATE ============
async function onMessageUpdate(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
) {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const client = newMessage.client as MyClient;
    const author = newMessage.author;

    const before = (oldMessage.content ?? '*нет в кеше*').slice(0, 700);
    const after = (newMessage.content ?? '*пусто*').slice(0, 700);

    const container = buildLogContainer(
        `Сообщение изменено — ${author?.username ?? 'unknown'}`,
        newMessage.channelId,
        `Автор: ${author?.username ?? 'unknown'} (${author?.id ?? '—'})\n` +
            `Было: ${before}\n` +
            `Стало: ${after}`,
    );

    await sendLogEvent(client, newMessage.guild, 'message_edit', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ BULK DELETE ============
async function onMessageDeleteBulk(
    messages: Collection<string, Message | PartialMessage>,
) {
    const first = messages.first();
    if (!first?.guild) return;

    const client = first.client as MyClient;

    const lines = messages
        .map((m) => {
            const author = m.author?.username ?? 'unknown';
            const content = m.content?.slice(0, 80) ?? '—';
            return `${author}: ${content}`;
        })
        .slice(0, 20);

    const container = buildLogContainer(
        `Массовое удаление (${messages.size})`,
        first.channelId,
        lines.join('\n').slice(0, 3500),
    );

    await sendLogEvent(client, first.guild, 'message_bulk_delete', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ MEMBER ADD ============
async function onGuildMemberAdd(member: GuildMember) {
    const client = member.client as MyClient;

    const container = buildLogContainer(
        `Участник присоединился — ${member.user.username}`,
        null,
        `Участник: ${member.user.username} (${member.id})\n` +
            `Аккаунт создан: ${formatTs(member.user.createdTimestamp)}\n` +
            `Участников: ${member.guild.memberCount}`,
    );

    await sendLogEvent(client, member.guild, 'member_join', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ MEMBER REMOVE ============
async function onGuildMemberRemove(member: GuildMember | PartialGuildMember) {
    const client = member.client as MyClient;
    const user = member.user;

    const container = buildLogContainer(
        `Участник покинул сервер — ${user?.username ?? 'unknown'}`,
        null,
        `Участник: ${user?.username ?? 'unknown'} (${member.id})\n` +
            `Участников: ${member.guild.memberCount}`,
    );

    await sendLogEvent(client, member.guild, 'member_leave', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ CHANNEL CREATE ============
async function onChannelCreate(channel: GuildBasedChannel) {
    if (!channel.guild) return;
    const client = channel.client as MyClient;

    const container = buildLogContainer(
        `Канал создан — #${channel.name}`,
        null,
        `Канал: #${channel.name}\n` +
            `ID: ${channel.id}\n` +
            `Тип: ${channel.type}`,
    );

    await sendLogEvent(client, channel.guild, 'channel_create', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ CHANNEL DELETE ============
async function onChannelDelete(channel: DMChannel | GuildBasedChannel) {
    if (!('guild' in channel) || !channel.guild) return;
    const client = channel.client as MyClient;

    const container = buildLogContainer(
        `Канал удалён — #${channel.name}`,
        null,
        `Канал: #${channel.name}\n` +
            `ID: ${channel.id}`,
    );

    await sendLogEvent(client, channel.guild, 'channel_delete', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ ROLE CREATE ============
async function onRoleCreate(role: Role) {
    const client = role.client as MyClient;

    const container = buildLogContainer(
        `Роль создана — ${role.name}`,
        null,
        `Роль: ${role.name}\n` +
            `ID: ${role.id}`,
    );

    await sendLogEvent(client, role.guild, 'role_create', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ ROLE DELETE ============
async function onRoleDelete(role: Role) {
    const client = role.client as MyClient;

    const container = buildLogContainer(
        `Роль удалена — ${role.name}`,
        null,
        `Роль: ${role.name}\n` +
            `ID: ${role.id}`,
    );

    await sendLogEvent(client, role.guild, 'role_delete', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ BAN ADD ============
async function onGuildBanAdd(ban: GuildBan) {
    const client = ban.client as MyClient;

    const container = buildLogContainer(
        `Пользователь забанен — ${ban.user.username}`,
        null,
        `Пользователь: ${ban.user.username} (${ban.user.id})\n` +
            `Причина: ${ban.reason?.slice(0, 500) ?? '—'}`,
    );

    await sendLogEvent(client, ban.guild, 'member_ban', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ BAN REMOVE ============
async function onGuildBanRemove(ban: GuildBan) {
    const client = ban.client as MyClient;

    const container = buildLogContainer(
        `Пользователь разбанен — ${ban.user.username}`,
        null,
        `Пользователь: ${ban.user.username} (${ban.user.id})`,
    );

    await sendLogEvent(client, ban.guild, 'member_unban', {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ============ VOICE STATE ============
async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const client = newState.client as MyClient;
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const guild = newState.guild;
    const username = member.user.username;

    // Вошёл
    if (!oldState.channelId && newState.channelId) {
        const container = buildLogContainer(
            `Вошёл в голосовой канал — ${username}`,
            newState.channelId,
            `Участник: ${username} (${member.id})`,
        );
        await sendLogEvent(client, guild, 'voice_join', {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    // Вышел
    if (oldState.channelId && !newState.channelId) {
        const container = buildLogContainer(
            `Покинул голосовой канал — ${username}`,
            oldState.channelId,
            `Участник: ${username} (${member.id})`,
        );
        await sendLogEvent(client, guild, 'voice_leave', {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    // Перешёл
    if (
        oldState.channelId &&
        newState.channelId &&
        oldState.channelId !== newState.channelId
    ) {
        const container = buildLogContainer(
            `Сменил голосовой канал — ${username}`,
            newState.channelId,
            `Участник: ${username} (${member.id})\n` +
                `Из: <#${oldState.channelId}>\n` +
                `В:  <#${newState.channelId}>`,
        );
        await sendLogEvent(client, guild, 'voice_move', {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}

// ============ EXPORT ============
export default [
    { name: 'messageDelete', once: false, execute: onMessageDelete },
    { name: 'messageUpdate', once: false, execute: onMessageUpdate },
    { name: 'messageDeleteBulk', once: false, execute: onMessageDeleteBulk },
    { name: 'guildMemberAdd', once: false, execute: onGuildMemberAdd },
    { name: 'guildMemberRemove', once: false, execute: onGuildMemberRemove },
    { name: 'channelCreate', once: false, execute: onChannelCreate },
    { name: 'channelDelete', once: false, execute: onChannelDelete },
    { name: 'roleCreate', once: false, execute: onRoleCreate },
    { name: 'roleDelete', once: false, execute: onRoleDelete },
    { name: 'guildBanAdd', once: false, execute: onGuildBanAdd },
    { name: 'guildBanRemove', once: false, execute: onGuildBanRemove },
    { name: 'voiceStateUpdate', once: false, execute: onVoiceStateUpdate },
];