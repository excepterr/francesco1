import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import path from 'path';
import { t } from '../../../lib/i18n';
import { getGuildSettings, updateGuildModules } from '../../../lib/guildSettings';
import { getModuleNames } from '../../../lib/fileWalker';
import { createCollector } from '../../../lib/components';

// Модули, которые нельзя отключить
const PROTECTED = ['help', 'config'];

function buildEmbed(
    interaction: ChatInputCommandInteraction,
    lang: string,
    allModules: string[],
    disabled: string[],
    wasChanged = false,
): EmbedBuilder {
    // 👇 Активные = всего МИНУС отключённые
    const active = allModules.length - disabled.length;
    const total = allModules.length;

    const embed = new EmbedBuilder()
        .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp()
        .addFields({
            name: t(lang, 'config.currentSettings'),
            value: t(lang, 'config.modules.currentValue', { active, total }),
        });

    if (wasChanged) {
        embed.addFields({
            name: t(lang, 'config.info'),
            value: t(lang, 'config.modules.changedInfo', { active, total }),
        });
    }
    return embed;
}
export async function handleConfigModules(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const settings = await getGuildSettings(interaction.guildId!);
    const commandsPath = path.join(__dirname, '..', '..', '..', 'commands');
    const allModules = getModuleNames(commandsPath);

    // Исключаем защищённые модули из меню
    const toggleable = allModules.filter((m) => !PROTECTED.includes(m));

    const menu = new StringSelectMenuBuilder()
        .setCustomId('config_modules_select')
        .setPlaceholder(t(lang, 'config.modules.selectPlaceholder'))
        .setMinValues(0)
        .setMaxValues(toggleable.length)
        .addOptions(
            toggleable.map((mod) => ({
                label: mod,
                value: mod,
                default: !settings.disabled_modules.includes(mod),
            })),
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    const embed = buildEmbed(interaction, lang, allModules, settings.disabled_modules);

    const response = await interaction.editReply({
        embeds: [embed],
        components: [row],
    });

    createCollector(interaction.user.id, response, {
        lang,
        onCollect: async (i) => {
            if (!i.isStringSelectMenu()) return;
            const enabled = i.values;
            const disabled = toggleable.filter((m) => !enabled.includes(m));

            await updateGuildModules(interaction.guildId!, disabled);

            const newEmbed = buildEmbed(interaction, lang, allModules, disabled, true);
            const newMenu = new StringSelectMenuBuilder()
                .setCustomId('config_modules_select')
                .setPlaceholder(t(lang, 'config.modules.selectPlaceholder'))
                .setMinValues(0)
                .setMaxValues(toggleable.length)
                .addOptions(
                    toggleable.map((mod) => ({
                        label: mod,
                        value: mod,
                        default: !disabled.includes(mod),
                    })),
                );
            const newRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newMenu);

            await i.update({ embeds: [newEmbed], components: [newRow] });
        },
    });
}