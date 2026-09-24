import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { getUserLanguage, t, getLocalizations } from '../../lib/i18n';
import { UserError } from '../../lib/errors';
import * as eco from '../../lib/economy';
import { getCurrency } from '../../lib/currency';
import { formatDate } from '../../lib/commandIds';

export default {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work and earn money.')
        .setDescriptionLocalizations(getLocalizations('commands.work.description')),

    async execute(interaction: ChatInputCommandInteraction) {
        const lang = getUserLanguage(interaction);
        const guildId = interaction.guildId!;
        const user = await eco.getUser(guildId, interaction.user.id);
        const cur = await getCurrency(guildId);

        const now = Date.now();
        const cd = eco.COOLDOWNS.work;
        if (now - user.last_work < cd) {
            const next = Math.floor((user.last_work + cd) / 1000);
            throw new UserError(t(lang, 'economy.cooldown', { time: `<t:${next}:R>` }));
        }

        const job = eco.WORK_JOBS[Math.floor(Math.random() * eco.WORK_JOBS.length)];
        const income = 10 + Math.floor(Math.random() * (user.level * 5 + 10));

        let newXp = user.xp + 1;
        let newLevel = user.level;
        let need = eco.xpForLevel(newLevel);
        while (newXp >= need && newLevel < eco.MAX_LEVEL) {
            newXp -= need;
            newLevel += 1;
            need = eco.xpForLevel(newLevel);
        }
        if (newLevel >= eco.MAX_LEVEL) {
            newXp = 0;
            need = eco.xpForLevel(eco.MAX_LEVEL);
        }

        await eco.addMoney(guildId, user.user_id, income);
        await eco.updateUser(guildId, user.user_id, {
            xp: newXp,
            level: newLevel,
            last_work: now,
        });

        const embed = new EmbedBuilder()
            .setTitle(`${t(lang, 'economy.workTitle')} — ${interaction.user.username}`)
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
            .setDescription(
                t(lang, 'economy.workDescription', {
                    user: interaction.user.username,
                    job,
                }),
            )
            .addFields(
                {
                    name: t(lang, 'economy.workIncome'),
                    value: `${eco.fmt(income)} ${cur.emoji}`,
                },
                {
                    name: t(lang, 'economy.workProgress'),
                    value: `${newLevel} ${t(lang, 'economy.level')} — [${newXp}/${need}]`,
                },
            )
            .setFooter({ text: formatDate(now) });

        await interaction.editReply({ embeds: [embed] });
    },
};