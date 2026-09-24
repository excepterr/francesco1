import {
    Message,
    MessageComponentInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    AnyComponentBuilder,
} from 'discord.js';
import { t } from './i18n';

interface CollectorOptions {
    idleTime?: number;
    maxTime?: number;
    onCollect: (interaction: MessageComponentInteraction) => Promise<void>;
    onEnd?: (reason: string) => Promise<void>;
    lang?: string;
}

/**
 * Отключает все компоненты в сообщении (ставит disabled: true).
 * Возвращает новый массив рядов.
 */
function disableAllComponents(message: Message): any[] {
    return message.components.map((row) => {
        const components = row.components.map((comp) => {
            // Клонируем и отключаем
            const json = comp.toJSON();
            json.disabled = true;
            return json;
        });
        return { type: 1, components }; // type 1 = ActionRow
    });
}

export function createCollector(
    ownerId: string,
    message: Message,
    options: CollectorOptions,
): void {
    const idleTime = options.idleTime ?? 30_000;
    const maxTime = options.maxTime ?? 300_000;

    const collector = message.createMessageComponentCollector({
        idle: idleTime,
        time: maxTime,
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== ownerId) {
            await i
                .reply({
                    content: t(options.lang ?? 'en', 'components.notOwner'),
                    ephemeral: true,
                })
                .catch(() => {});
            return;
        }

        try {
            await options.onCollect(i);
        } catch (error) {
            console.error('[COMPONENT]', error);
            try {
                const payload = {
                    content: t(options.lang ?? 'en', 'errors.generic'),
                    ephemeral: true,
                };
                if (i.replied || i.deferred) await i.followUp(payload);
                else await i.reply(payload);
            } catch {}
        }

        collector.resetTimer({ idle: idleTime });
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'idle' || reason === 'time') {
            try {
                // 👇 Отключаем, а не удаляем
                const disabled = disableAllComponents(message);
                await message.edit({ components: disabled });
            } catch {}
        }
        if (options.onEnd) await options.onEnd(reason);
    });
}