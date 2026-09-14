const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../config.json');

const descriptions = {
    // ── admin ──
    edit: {
        en: 'Opens the configuration panel to change the bot prefix and language for this server.',
        ru: 'Открывает панель настроек для изменения префикса и языка бота на этом сервере.',
        ja: 'このサーバーのボットのプレフィックスと言語を変更する設定パネルを開きます。',
    },
    music: {
        en: 'Music player: play, queue, skip, pause, volume, loop and more.',
        ru: 'Музыкальный плеер: воспроизведение, очередь, скип, пауза, громкость, повтор.',
        ja: '音楽プレーヤー：再生、キュー、スキップ、一時停止、音量、リピートなど。',
    },
    say: {
        en: 'Sends a message as the bot to the current channel.',
        ru: 'Отправляет сообщение от имени бота в текущий канал.',
        ja: 'ボットとして現在のチャンネルにメッセージを送信します。',
    },

    // ── info ──
    about: {
        en: 'Shows statistics and technical information about the bot.',
        ru: 'Показывает статистику и техническую информацию о боте.',
        ja: 'ボットの統計と技術情報を表示します。',
    },
    avatar: {
        en: 'Shows the avatar of the specified user or yourself.',
        ru: 'Показывает аватар указанного пользователя или ваш собственный.',
        ja: '指定したユーザーまたは自分のアバターを表示します。',
    },
    banner: {
        en: 'Shows the profile banner of the specified user.',
        ru: 'Показывает баннер профиля указанного пользователя.',
        ja: '指定したユーザーのプロフィールバナーを表示します。',
    },
    channel: {
        en: 'Shows detailed information about the selected channel.',
        ru: 'Показывает подробную информацию о выбранном канале.',
        ja: '選択したチャンネルの詳細情報を表示します。',
    },
    emoji: {
        en: 'Lists or inspects emojis on this server.',
        ru: 'Показывает список или информацию об эмодзи сервера.',
        ja: 'このサーバーの絵文字一覧または詳細を表示します。',
    },
    guild: {
        en: 'Shows information about the current server.',
        ru: 'Показывает информацию о текущем сервере.',
        ja: '現在のサーバーに関する情報を表示します。',
    },
    help: {
        en: 'Shows the list of available commands with examples and details.',
        ru: 'Показывает список доступных команд с примерами и подробностями.',
        ja: '利用可能なコマンドの一覧を例と詳細付きで表示します。',
    },
    ping: {
        en: 'Reports the current response time and connection status of the bot.',
        ru: 'Сообщает текущее время отклика и состояние соединения бота.',
        ja: 'ボットの現在の応答時間と接続状態を報告します。',
    },
    roles: {
        en: 'Shows detailed information about the selected role.',
        ru: 'Показывает подробную информацию о выбранной роли.',
        ja: '選択したロールの詳細情報を表示します。',
    },
    timestamp: {
        en: 'Generates Discord-formatted timestamps for the given date or time.',
        ru: 'Генерирует Discord-таймстемпы для указанной даты или времени.',
        ja: '指定した日時のDiscordタイムスタンプを生成します。',
    },
    user: {
        en: 'Shows detailed information about the selected user.',
        ru: 'Показывает подробную информацию о выбранном пользователе.',
        ja: '選択したユーザーの詳細情報を表示します。',
    },
    wiki: {
        en: 'Searches Wikipedia articles and shows a short summary with a link.',
        ru: 'Ищет статьи в Википедии и показывает краткое содержание со ссылкой.',
        ja: 'ウィキペディアの記事を検索し、リンク付きの要約を表示します。',
    },

    // ── fun ──
    confessions: {
        en: 'Manages AI memory containers for channels on this server.',
        ru: 'Управляет контейнерами памяти ИИ для каналов на этом сервере.',
        ja: 'このサーバーのチャンネル用AIメモリコンテナを管理します。',
    },
    birthday: {
        en: 'Manage member birthdays: set, view or remove.',
        ru: 'Управление днями рождения участников: установка, просмотр и удаление.',
        ja: 'メンバーの誕生日を管理：設定、表示、削除。',
    },

    // ── interactions ──
    actions: {
        en: 'GIF-based interactions and emotions for members.',
        ru: 'Взаимодействия и эмоции с гифками для участников.',
        ja: 'メンバー向けのGIFを使った交流と感情表現。',
    },

    // ── moderation ──
    ban: {
        en: 'Bans a member from the server with an optional message purge.',
        ru: 'Блокирует участника на сервере с опциональной очисткой сообщений.',
        ja: 'メンバーをサーバーからBANします（メッセージ削除も可能）。',
    },
    kick: {
        en: 'Kicks a member from the server.',
        ru: 'Выгоняет участника с сервера.',
        ja: 'メンバーをサーバーからキックします。',
    },
    lock: {
        en: 'Locks a channel so @everyone cannot send messages.',
        ru: 'Закрывает канал — @everyone теряет право писать.',
        ja: 'チャンネルをロックして @everyone の送信を禁止します。',
    },
    unlock: {
        en: 'Unlocks a previously locked channel.',
        ru: 'Открывает ранее закрытый канал.',
        ja: '以前にロックされたチャンネルのロックを解除します。',
    },
    nickname: {
        en: 'Changes the nickname of a member.',
        ru: 'Изменяет никнейм участника.',
        ja: 'メンバーのニックネームを変更します。',
    },
    purge: {
        en: 'Bulk-deletes up to 100 messages in the current channel.',
        ru: 'Массово удаляет до 100 сообщений в текущем канале.',
        ja: '現在のチャンネルで最大100件のメッセージを一括削除します。',
    },
    role: {
        en: 'Adds or removes a role from a member.',
        ru: 'Выдаёт или снимает роль у участника.',
        ja: 'メンバーにロールを付与または削除します。',
    },
    slowmode: {
        en: 'Sets slowmode for the current or specified channel.',
        ru: 'Устанавливает медленный режим для канала.',
        ja: '現在または指定されたチャンネルにスローモードを設定します。',
    },
    softban: {
        en: 'Bans and immediately unbans a member to purge their messages.',
        ru: 'Банит и сразу разбанит участника для очистки его сообщений.',
        ja: 'メンバーをBANして即解除し、メッセージを削除します。',
    },
    timeout: {
        en: 'Timeouts (mutes) a member for the specified duration.',
        ru: 'Выдаёт тайм-аут (мьют) участнику на указанное время.',
        ja: 'メンバーを指定時間タイムアウト（ミュート）します。',
    },
    untimeout: {
        en: 'Removes an active timeout from a member.',
        ru: 'Снимает активный тайм-аут с участника.',
        ja: 'メンバーのタイムアウトを解除します。',
    },
    unban: {
        en: 'Unbans a user by their ID.',
        ru: 'Разблокирует пользователя по его ID.',
        ja: 'IDでユーザーのBANを解除します。',
    },
    unbanall: {
        en: 'Unbans every banned user on the server.',
        ru: 'Разблокирует всех забаненных на сервере.',
        ja: 'サーバー上の全BANユーザーを解除します。',
    },
    voicemove: {
        en: 'Moves a member to another voice channel.',
        ru: 'Перемещает участника в другой голосовой канал.',
        ja: 'メンバーを別のボイスチャンネルへ移動します。',
    },
    warn: {
        en: 'Warning system: add, remove, purge or view warnings.',
        ru: 'Система предупреждений: выдача, удаление, очистка, просмотр.',
        ja: '警告システム：発行、削除、クリア、一覧表示。',
    },
    infrastructure: {
        en: 'Server infrastructure tools: banlist, prune, staff list.',
        ru: 'Инструменты инфраструктуры: список банов, очистка, персонал.',
        ja: 'サーバーインフラツール：BANリスト、整理、スタッフ一覧。',
    },

    // ── settings ──
    settings: {
        en: 'Opens the server settings panel: enable or disable command categories.',
        ru: 'Открывает панель настроек сервера: включение и отключение категорий команд.',
        ja: 'サーバー設定パネルを開きます：コマンドカテゴリの有効/無効を切替。',
    },

    // ── utilities ──
    logging: {
        en: 'Manages server event logging: channel, categories and status.',
        ru: 'Управляет логированием событий сервера: канал, категории и статус.',
        ja: 'サーバーイベントのログを管理します：チャンネル、カテゴリ、ステータス。',
    },
    websearch: {
        en: 'Search Wikipedia, Genshin Impact, Steam or YouTube.',
        ru: 'Поиск в Википедии, Genshin Impact, Steam или YouTube.',
        ja: 'ウィキペディア、原神、Steam、YouTubeを検索します。',
    },

    // ── economy ──
    balance: {
        en: 'Shows your balance and current exchange rates.',
        ru: 'Показывает ваш баланс и актуальные курсы валют.',
        ja: '残高と現在の為替レートを表示します。',
    },
    crypto: {
        en: 'Cryptocurrency list, add (owner), remove (owner).',
        ru: 'Криптовалюты: список, добавление и удаление (владелец).',
        ja: '暗号通貨：一覧、追加、削除（オーナー）。',
    },
    employment: {
        en: 'Get paid: daily (6 USD / 24h) or timely (2 USD / 12h).',
        ru: 'Заработок: daily (6 USD / 24ч) или timely (2 USD / 12ч).',
        ja: '仕事：daily (6 USD / 24h) または timely (2 USD / 12h)。',
    },
    shop: {
        en: 'Role shop: browse, buy, manage roles for sale.',
        ru: 'Магазин ролей: список, покупка и управление ролями.',
        ja: 'ロールショップ：一覧、購入、管理。',
    },

    // ── music (проверь, что добавлен) ──
    music: {
        en: 'Music player: play, queue, skip, pause, volume, loop and more.',
        ru: 'Музыкальный плеер: воспроизведение, очередь, скип, пауза, громкость, повтор.',
        ja: '音楽プレーヤー：再生、キュー、スキップ、一時停止、音量、リピートなど。',
    },

    // ── websearch (проверь, что добавлен) ──
    websearch: {
        en: 'Search Wikipedia, Genshin Impact profiles, Steam profiles or YouTube channels.',
        ru: 'Поиск в Википедии, профилей Genshin Impact, Steam или YouTube-каналов.',
        ja: 'ウィキペディア、原神プロフィール、Steamプロフィール、YouTubeチャンネルを検索。',
    },

        token: {
        en: 'Inspect or block a transaction by its UUID token.',
        ru: 'Просмотр или блокировка транзакции по UUID-токену.',
        ja: '取引をUUIDトークンで表示・ブロックします。',
    },
    currency: {
        en: 'Manage currencies: list, set preferred, create a server currency.',
        ru: 'Управление валютами: список, выбор, создание серверной валюты.',
        ja: '通貨の管理：一覧、切替、サーバー通貨の作成。',
    },
    p2p: {
        en: 'P2P currency market: list, sell, buy, cancel listings.',
        ru: 'P2P-рынок валют: лоты, продажа, покупка, отмена.',
        ja: 'P2P通貨マーケット：出品、売買、キャンセル。',
    },
};

module.exports = (client) => {
    client.slashIds = new Map();
    const slashCommands = [];
    const slashPath = path.join(__dirname, '../slash_commands');

    const seen = new Map(); // name -> { category, file }

    for (const folder of fs.readdirSync(slashPath)) {
        const folderPath = path.join(slashPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            if (!command.data || !command.slashExecute) continue;

            const name = command.data.name;

            if (seen.has(name)) {
                const prev = seen.get(name);
                console.error(
                    `\n❌ DUPLICATE COMMAND: /${name}\n` +
                    `   Уже загружена: ${prev.file} (${prev.category})\n` +
                    `   Пытаемся снова: ${filePath} (${folder})\n` +
                    `   → удали один из файлов.\n`
                );
                continue;
            }

            seen.set(name, { category: folder, file: filePath });
            command.category = folder;
            client.slashCommands.set(name, command);

            const desc = descriptions[name];
            if (desc) {
                command.data
                    .setDescription(desc.en)
                    .setDescriptionLocalization('en-US', desc.en)
                    .setDescriptionLocalization('ru', desc.ru)
                    .setDescriptionLocalization('ja', desc.ja);
            }

            if (command.components) {
                for (const [customId, handler] of Object.entries(command.components)) {
                    client.components.set(customId, handler);
                }
            }
            slashCommands.push(command.data.toJSON());
        }
    }

    const rest = new REST({ version: '10' }).setToken(config.token);

    (async () => {
        try {
            const registered = await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: slashCommands }
            );

            for (const cmd of registered) {
                client.slashIds.set(cmd.name, cmd.id);
            }

            console.log(`Зарегистрировано ${slashCommands.length} слеш-команд.`);
        } catch (error) {
            console.error(error);
        }
    })();
};