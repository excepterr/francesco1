module.exports = {
    edit: [{ args: '', description: { ru: 'Открывает меню настроек: префикс и язык.', en: 'Opens settings: prefix and language.', ja: '設定メニューを開きます。' } }],
    ping: [{ args: '', description: { ru: 'Показывает задержку бота.', en: 'Shows bot latency.', ja: 'レイテンシを表示。' } }],
    about: [{ args: '', description: { ru: 'Информация о боте.', en: 'Bot information.', ja: 'ボット情報。' } }],
    say: [{ args: 'text', description: { ru: 'Отправляет текст от имени бота.', en: 'Sends text as the bot.', ja: 'ボットとして送信。' } }],
    avatar: [{ args: 'member', description: { ru: 'Аватар пользователя.', en: 'User avatar.', ja: 'ユーザーのアバター。' } }],
    banner: [{ args: 'member', description: { ru: 'Баннер пользователя.', en: 'User banner.', ja: 'ユーザーのバナー。' } }],

    help: [{ args: 'command', description: { ru: 'Информация о команде.', en: 'Command details.', ja: 'コマンド情報。' } }],

    user: [{ args: 'info member', description: { ru: 'Информация о пользователе.', en: 'User information.', ja: 'ユーザー情報。' } }],
    guild: [
        { args: 'info', description: { ru: 'Информация о сервере.', en: 'Server information.', ja: 'サーバー情報。' } },
        { args: 'icon', description: { ru: 'Иконка сервера.', en: 'Server icon.', ja: 'サーバーアイコン。' } },
    ],
    channel: [{ args: 'info channel', description: { ru: 'Информация о канале.', en: 'Channel information.', ja: 'チャンネル情報。' } }],
    role: [{ args: 'info role', description: { ru: 'Информация о роли.', en: 'Role information.', ja: 'ロール情報。' } }],
    emoji: [
        { args: 'list', description: { ru: 'Список эмодзи сервера.', en: 'List of server emojis.', ja: 'サーバー絵文字一覧。' } },
        { args: 'info emoji', description: { ru: 'Информация об эмодзи.', en: 'Emoji information.', ja: '絵文字の情報。' } },
    ],
    timestamp: [{ args: 'time', description: { ru: 'Генерирует Discord-таймстемпы.', en: 'Generates Discord timestamps.', ja: 'Discord タイムスタンプを生成。' } }],
    wiki: [{ args: 'query', description: { ru: 'Поиск в Википедии.', en: 'Wikipedia search.', ja: 'ウィキペディア検索。' } }],

    confessions: [
        { args: 'create channel', description: { ru: 'Создать контейнер памяти ИИ.', en: 'Create an AI memory container.', ja: 'AIコンテナを作成。' } },
        { args: 'list', description: { ru: 'Список контейнеров.', en: 'List containers.', ja: 'コンテナ一覧。' } },
        { args: 'block id', description: { ru: 'Удалить контейнер по ID.', en: 'Delete container by ID.', ja: 'IDで削除。' } },
        { args: 'report id reason', description: { ru: 'Отправить контейнер владельцу.', en: 'Report container to owner.', ja: 'オーナーにレポート。' } },
    ],
    actions: [{ args: 'action user', description: { ru: 'Взаимодействия с гифками.', en: 'GIF-based interactions.', ja: 'GIF を使った交流。' } }],

    birthday: [
        { args: 'set date', description: { ru: 'Установить день рождения.', en: 'Set birthday.', ja: '誕生日を設定。' } },
        { args: 'view user', description: { ru: 'Посмотреть дни рождения.', en: 'View birthdays.', ja: '誕生日を表示。' } },
        { args: 'delete', description: { ru: 'Удалить свой день рождения.', en: 'Remove your birthday.', ja: '自分の誕生日を削除。' } },
    ],

    settings: [{ args: '', description: { ru: 'Категории команд вкл/выкл.', en: 'Toggle command categories.', ja: 'カテゴリの切替。' } }],
    logging: [
        { args: 'enable', description: { ru: 'Включить логирование.', en: 'Enable logging.', ja: 'ログを有効化。' } },
        { args: 'disable', description: { ru: 'Выключить логирование.', en: 'Disable logging.', ja: 'ログを無効化。' } },
        { args: 'channel channel', description: { ru: 'Установить канал логов.', en: 'Set the log channel.', ja: 'ログチャンネルを設定。' } },
        { args: 'show', description: { ru: 'Текущие настройки логов.', en: 'Current logging settings.', ja: '現在の設定。' } },
        { args: 'settings', description: { ru: 'Панель категорий логов.', en: 'Log categories panel.', ja: 'カテゴリパネル。' } },
    ],

    ban: [{ args: 'user reason delete_days', description: { ru: 'Забанить участника.', en: 'Ban a member.', ja: 'メンバーをBAN。' } }],
    unban: [{ args: 'user reason', description: { ru: 'Разбанить по ID.', en: 'Unban by ID.', ja: 'IDでBAN解除。' } }],
    unbanall: [{ args: 'reason', description: { ru: 'Разбанить всех.', en: 'Unban all.', ja: '一括BAN解除。' } }],
    kick: [{ args: 'user reason', description: { ru: 'Кикнуть участника.', en: 'Kick a member.', ja: 'キック。' } }],
    softban: [{ args: 'user reason delete_days', description: { ru: 'Softban — кик с очисткой.', en: 'Softban — kick with purge.', ja: 'ソフトバン。' } }],
    timeout: [{ args: 'user amount unit reason', description: { ru: 'Выдать тайм-аут.', en: 'Timeout a member.', ja: 'タイムアウト。' } }],
    untimeout: [{ args: 'user reason', description: { ru: 'Снять тайм-аут.', en: 'Remove timeout.', ja: 'タイムアウト解除。' } }],
    warn: [
        { args: 'add user reason', description: { ru: 'Выдать предупреждение.', en: 'Issue a warning.', ja: '警告を発行。' } },
        { args: 'remove user id reason', description: { ru: 'Удалить предупреждение.', en: 'Remove a warning.', ja: '警告を削除。' } },
        { args: 'purge user reason', description: { ru: 'Очистить все предупреждения.', en: 'Clear all warnings.', ja: '警告を全削除。' } },
        { args: 'showlist user', description: { ru: 'Список предупреждений.', en: 'Show warnings.', ja: '警告一覧。' } },
    ],
    lock: [{ args: 'channel reason', description: { ru: 'Закрыть канал.', en: 'Lock a channel.', ja: 'チャンネルをロック。' } }],
    unlock: [{ args: 'channel reason', description: { ru: 'Открыть канал.', en: 'Unlock a channel.', ja: 'ロック解除。' } }],
    slowmode: [{ args: 'seconds channel', description: { ru: 'Медленный режим.', en: 'Set slowmode.', ja: 'スローモード。' } }],
    purge: [{ args: 'amount user', description: { ru: 'Удалить сообщения.', en: 'Delete messages.', ja: 'メッセージ削除。' } }],
    nickname: [{ args: 'user nickname', description: { ru: 'Сменить ник.', en: 'Change nickname.', ja: 'ニックネーム変更。' } }],
    role: [
        { args: 'add user role reason', description: { ru: 'Выдать роль.', en: 'Add a role.', ja: 'ロール付与。' } },
        { args: 'remove user role reason', description: { ru: 'Снять роль.', en: 'Remove a role.', ja: 'ロール削除。' } },
    ],
    voicemove: [{ args: 'user channel reason', description: { ru: 'Переместить по голосовым.', en: 'Move in voice.', ja: 'ボイス移動。' } }],
    infrastructure: [
        { args: 'banlist query', description: { ru: 'Список забаненных.', en: 'Ban list.', ja: 'BAN一覧。' } },
        { args: 'prune days exclude_role', description: { ru: 'Кикнуть неактивных.', en: 'Prune inactive.', ja: '非アクティブをキック。' } },
        { args: 'staff role', description: { ru: 'Список модераторов.', en: 'Staff list.', ja: 'スタッフ一覧。' } },
    ],
    websearch: [
        { args: 'wiki query', description: { ru: 'Поиск статьи в Википедии.', en: 'Search a Wikipedia article.', ja: 'ウィキペディアの記事を検索。' } },
        { args: 'genshin type query', description: { ru: 'Поиск персонажа/оружия в Genshin Impact.', en: 'Search Genshin Impact character/weapon.', ja: '原神のキャラ/武器を検索。' } },
        { args: 'steam query', description: { ru: 'Поиск игр в Steam.', en: 'Search games on Steam.', ja: 'Steamでゲームを検索。' } },
        { args: 'youtube query', description: { ru: 'Поиск видео на YouTube.', en: 'Search videos on YouTube.', ja: 'YouTubeで動画を検索。' } },
    ],
    music: [
        { args: 'play query', description: { ru: 'Включает трек по названию или ссылке.', en: 'Plays a track by name or URL.', ja: '名前またはURLで再生。' } },
        { args: 'skip', description: { ru: 'Пропускает текущий трек.', en: 'Skips the current track.', ja: '現在のトラックをスキップ。' } },
        { args: 'stop', description: { ru: 'Останавливает плеер и чистит очередь.', en: 'Stops the player and clears the queue.', ja: '停止してキューをクリア。' } },
        { args: 'pause / resume', description: { ru: 'Пауза / продолжить.', en: 'Pause / resume.', ja: '一時停止/再開。' } },
        { args: 'queue', description: { ru: 'Показывает очередь треков.', en: 'Shows the track queue.', ja: 'キューを表示。' } },
        { args: 'nowplaying', description: { ru: 'Показывает текущий трек.', en: 'Shows the current track.', ja: '現在のトラックを表示。' } },
        { args: 'volume percent', description: { ru: 'Устанавливает громкость 0–200%.', en: 'Sets volume 0–200%.', ja: '音量を0〜200%に設定。' } },
        { args: 'loop mode', description: { ru: 'Режим повтора: off / one / all.', en: 'Loop mode: off / one / all.', ja: 'リピート: off / one / all。' } },
        { args: 'shuffle', description: { ru: 'Перемешивает очередь.', en: 'Shuffles the queue.', ja: 'キューをシャッフル。' } },
        { args: 'leave', description: { ru: 'Выходит из голосового канала.', en: 'Leaves the voice channel.', ja: 'ボイスから退出。' } },
    ],
    balance: [
        { args: 'user', description: { ru: 'Показать баланс и курсы.', en: 'Show balance and rates.', ja: '残高とレートを表示。' } },
    ],
    employment: [
        { args: 'daily', description: { ru: 'Забрать дневную зарплату (6 USD / 24ч).', en: 'Claim daily pay (6 USD / 24h).', ja: '日給を受け取る。' } },
        { args: 'timely', description: { ru: 'Забрать зарплату раз в 12ч (2 USD).', en: 'Claim timely pay (2 USD / 12h).', ja: '12時間ごとの給与。' } },
    ],
    shop: [
        { args: 'showlist', description: { ru: 'Показать роли в магазине.', en: 'Show shop roles.', ja: 'ショップのロール一覧。' } },
        { args: 'buy role', description: { ru: 'Купить роль за валюту.', en: 'Buy a role with currency.', ja: 'ロールを購入。' } },
        { args: 'addrole role price currency', description: { ru: '[ADMIN] Добавить роль в магазин.', en: '[ADMIN] Add a role to the shop.', ja: '[ADMIN] ロールを追加。' } },
        { args: 'removerole role', description: { ru: '[ADMIN] Убрать роль из магазина.', en: '[ADMIN] Remove a role from the shop.', ja: '[ADMIN] ロールを削除。' } },
    ],
    crypto: [
        { args: 'list', description: { ru: 'Список криптовалют с курсами и динамикой.', en: 'List cryptocurrencies with rates and dynamics.', ja: '暗号通貨一覧。' } },
        { args: 'add code name usd_rate', description: { ru: '[OWNER] Добавить крипту.', en: '[OWNER] Add a crypto.', ja: '[OWNER] 追加。' } },
        { args: 'remove code', description: { ru: '[OWNER] Удалить крипту.', en: '[OWNER] Remove a crypto.', ja: '[OWNER] 削除。' } },
    ],
};