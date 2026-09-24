import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';

export default {
    data: new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Channel information commands.')
        .setDescriptionLocalizations(getLocalizations('commands.channel.description'))
        .addSubcommand((sub) =>
            sub
                .setName('info')
                .setDescription('Shows information about a channel.')
                .setDescriptionLocalizations(
                    getLocalizations('commands.channel.info.description'),
                )
                .addChannelOption((opt) =>
                    opt
                        .setName('channel')
                        .setDescription('The channel to inspect.')
                        .setDescriptionLocalizations(
                            getLocalizations('commands.channel.info.option'),
                        ),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const sub = interaction.options.getSubcommand();
        if (sub !== 'info') return;

        const channel =
            interaction.options.getChannel('channel') ?? interaction.channel;

        if (!channel || !('name' in channel)) {
            throw new UserError(t(lang, 'errors.notFound'));
        }

        const ch: any = channel;
        const createdTs = Math.floor(ch.createdTimestamp / 1000);

        const embed = new EmbedBuilder()
            .setDescription(`### #${ch.name} (${ch.id})`)
            .addFields(
                {
                    name: t(lang, 'channel.category'),
                    value: ch.parent?.name ?? t(lang, 'channel.none'),
                    inline: true,
                },
                {
                    name: t(lang, 'channel.topic'),
                    value: ch.topic ? ch.topic.slice(0, 100) : t(lang, 'channel.noTopic'),
                    inline: true,
                },
            );

        if (ch.type === ChannelType.GuildText) {
            const invites = await ch.fetchInvites().catch(() => null);
            embed.addFields({
                name: t(lang, 'channel.invites'),
                value: `${invites?.size ?? 0}`,
                inline: true,
            });
        }

        embed.addFields({
            name: t(lang, 'channel.created'),
            value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`,
        });

        await interaction.editReply({ embeds: [embed] });
    },
};