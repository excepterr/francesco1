import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import { languages, t } from '../../../lib/i18n';
import { getGuildSettings, updateGuildLanguage } from '../../../lib/guildSettings';
import { createCollector } from '../../../lib/components';
import { getModuleNames } from '../../../lib/fileWalker';
import path from 'path';

function buildEmbed(
    interaction: ChatInputCommandInteraction,
    lang: string,
    currentLang: string,
    wasChanged = false,
): EmbedBuilder {
    const commandsPath = path.join(__dirname, '..', '..', '..', 'commands');
    const allModules = getModuleNames(commandsPath);
    const active = allModules.length; // для языка не важно, все активны
    const total = allModules.length;

    const embed = new EmbedBuilder()
        .setTitle(`${t(lang, 'config.title')} — ${interaction.user.username}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp()
        .addFields({
            name: t(lang, 'config.currentSettings'),
            value: [
                t(lang, 'config.modules.currentValue', { active, total }),
                t(lang, 'config.language.currentLang', {
                    lang: languages[currentLang as keyof typeof languages],
                }),
            ].join('\n'),
        });

    if (wasChanged) {
        embed.addFields({
            name: t(lang, 'config.info'),
            value: t(lang, 'config.changedInfo', {
                changed: t(lang, 'config.changedLanguage'),
                to: languages[currentLang as keyof typeof languages],
            }),
        });
    }
    return embed;
}

export async function handleConfigLanguage(
    interaction: ChatInputCommandInteraction,
    lang: string,
) {
    const settings = await getGuildSettings(interaction.guildId!);

    const menu = new StringSelectMenuBuilder()
        .setCustomId('config_language_select')
        .setPlaceholder(t(lang, 'config.language.selectPlaceholder'))
        .addOptions(
            Object.entries(languages).map(([code, name]) => ({
                label: name,
                value: code,
                default: code === settings.language,
            })),
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    const embed = buildEmbed(interaction, lang, settings.language);

    const response = await interaction.editReply({
        embeds: [embed],
        components: [row],
    });

    createCollector(interaction.user.id, response, {
        lang,
        onCollect: async (i) => {
            if (!i.isStringSelectMenu()) return;
            const newLang = i.values[0] as keyof typeof languages;

            await updateGuildLanguage(interaction.guildId!, newLang);

            // Обновляем сообщение, оставляя меню
            const newEmbed = buildEmbed(interaction, newLang, newLang, true);
            const newMenu = new StringSelectMenuBuilder()
                .setCustomId('config_language_select')
                .setPlaceholder(t(newLang, 'config.language.selectPlaceholder'))
                .addOptions(
                    Object.entries(languages).map(([code, name]) => ({
                        label: name,
                        value: code,
                        default: code === newLang,
                    })),
                );
            const newRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newMenu);

            await i.update({ embeds: [newEmbed], components: [newRow] });
        },
    });
}