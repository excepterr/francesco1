import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageComponentInteraction,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import * as eco from '../../lib/economy';
import { createCollector } from '../../lib/components';

export default {
    skipDefer: true,
    data: new SlashCommandBuilder()
        .setName('marriage')
        .setDescription('Marriage commands.')
        .setDescriptionLocalizations(getLocalizations('commands.marriage.description'))
        .addSubcommand((sub) =>
            sub
                .setName('propose')
                .setDescription('Propose to a user.')
                .setDescriptionLocalizations(getLocalizations('commands.marriage.propose.description'))
                .addUserOption((o) =>
                    o.setName('user').setDescription('User.').setRequired(true)
                        .setDescriptionLocalizations(getLocalizations('commands.marriage.userOption')),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('divorce')
                .setDescription('Divorce your partner.')
                .setDescriptionLocalizations(getLocalizations('commands.marriage.divorce.description')),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guildId = interaction.guildId!;
        const sub = interaction.options.getSubcommand();
        const me = await eco.getUser(guildId, interaction.user.id);

        // ===== DIVORCE =====
        if (sub === 'divorce') {
            if (!me.marry_partner) throw new UserError(t(lang, 'economy.notMarried'));
            const partnerId = me.marry_partner;
            await eco.updateUser(guildId, me.user_id, { marry_partner: null, marry_date: null });
            await eco.updateUser(guildId, partnerId, { marry_partner: null, marry_date: null });

            const embed = new EmbedBuilder()
                .setTitle(`💔 ${t(lang, 'economy.divorceTitle')}`)
                .setDescription(
                    t(lang, 'economy.divorceDescription', {
                        user: interaction.user.username,
                        partner: `<@${partnerId}>`,
                    }),
                )
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            return;
        }

        // ===== PROPOSE =====
        const target = interaction.options.getUser('user', true);
        if (target.id === interaction.user.id) throw new UserError(t(lang, 'economy.cantMarrySelf'));
        if (target.bot) throw new UserError(t(lang, 'economy.cantMarryBot'));
        if (me.marry_partner) throw new UserError(t(lang, 'economy.alreadyMarried'));

        const them = await eco.getUser(guildId, target.id);
        if (them.marry_partner) throw new UserError(t(lang, 'economy.targetMarried'));

        const embed = new EmbedBuilder()
            .setTitle(`💍 ${t(lang, 'economy.proposeTitle')}`)
            .setDescription(
                t(lang, 'economy.proposeDescription', {
                    from: `<@${interaction.user.id}>`,
                    to: `<@${target.id}>`,
                }),
            )
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('marry_yes').setLabel('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('marry_no').setLabel('❌').setStyle(ButtonStyle.Danger),
        );

        const response = await interaction.reply({
            content: `<@${target.id}>`,
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        createCollector(target.id, response, {
            lang,
            onCollect: async (i: MessageComponentInteraction) => {
                if (!i.isButton()) return;
                if (i.user.id !== target.id) return;

                if (i.customId === 'marry_no') {
                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`💔 ${t(lang, 'economy.proposeRejectedTitle')}`)
                                .setDescription(t(lang, 'economy.proposeRejected')),
                        ],
                        components: [],
                    });
                    return;
                }

                // marry_yes
                const now = Date.now();
                await eco.updateUser(guildId, interaction.user.id, {
                    marry_partner: target.id,
                    marry_date: now,
                });
                await eco.updateUser(guildId, target.id, {
                    marry_partner: interaction.user.id,
                    marry_date: now,
                });

                await i.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`💍 ${t(lang, 'economy.marriedTitle')}`)
                            .setDescription(
                                t(lang, 'economy.marriedDescription', {
                                    a: `<@${interaction.user.id}>`,
                                    b: `<@${target.id}>`,
                                }),
                            ),
                    ],
                    components: [],
                });
            },
        });
    },
};