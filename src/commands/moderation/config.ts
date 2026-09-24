import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits  } from 'discord.js';
import { getLocalizations, getUserLanguage } from '../../lib/i18n';
import { handleConfigLanguage } from './subcommands/language';
import { handleConfigModules } from './subcommands/modules';
import { handleConfigBirthdays } from './subcommands/birthdays';
import { handleConfigLogging } from './subcommands/logging';
import { handleConfigCurrency } from './subcommands/currency';

export default {
    localizationKey: 'config',
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure the bot for this server.')
        .setDescriptionLocalizations(getLocalizations('config.description'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) =>
            sub
                .setName('language')
                .setDescription('Change the server language.')
                .setDescriptionLocalizations(getLocalizations('config.language.description')),
        )
        .addSubcommand((sub) =>
            sub
                .setName('modules')
                .setDescription('Enable or disable modules.')
                .setDescriptionLocalizations(getLocalizations('config.modules.description')),
        )
        .addSubcommand((sub) =>
            sub
                .setName('birthdays')
                .setDescription('Configure birthday announcements.')
                .setDescriptionLocalizations(getLocalizations('config.birthdays.description'))
                .addChannelOption((opt) =>
                    opt
                        .setName('channel')
                        .setDescription('Channel for birthday announcements.')
                        .setDescriptionLocalizations(
                            getLocalizations('config.birthdays.channelOption'),
                        ),
                )
                .addBooleanOption((opt) =>
                    opt
                        .setName('enable')
                        .setDescription('Enable or disable the feature.')
                        .setDescriptionLocalizations(
                            getLocalizations('config.birthdays.enableOption'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('logging')
                .setDescription('Configure server logging.')
                .setDescriptionLocalizations(getLocalizations('config.logging.description'))
                .addChannelOption((opt) =>
                    opt
                        .setName('channel')
                        .setDescription('Channel for logs.')
                        .setDescriptionLocalizations(
                            getLocalizations('config.logging.channelOption'),
                        ),
                )
                .addBooleanOption((opt) =>
                    opt
                        .setName('enable')
                        .setDescription('Enable or disable logging.')
                        .setDescriptionLocalizations(
                            getLocalizations('config.logging.enableOption'),
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('currency')
                .setDescription('Configure the server currency.')
                .setDescriptionLocalizations(getLocalizations('config.currency.description'))
                .addStringOption((opt) =>
                    opt
                        .setName('emoji')
                        .setDescription('Currency emoji (e.g. 💎, 🪙).')
                        .setDescriptionLocalizations(getLocalizations('config.currency.emojiOption')),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('name')
                        .setDescription('Currency name (e.g. Coins).')
                        .setDescriptionLocalizations(getLocalizations('config.currency.nameOption')),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const lang = getUserLanguage(interaction);

        if (sub === 'language') return handleConfigLanguage(interaction, lang);
        if (sub === 'modules') return handleConfigModules(interaction, lang);
        if (sub === 'birthdays') return handleConfigBirthdays(interaction, lang);
        if (sub === 'logging') return handleConfigLogging(interaction, lang);
        if (sub === 'currency') return handleConfigCurrency(interaction, lang);
    },
};