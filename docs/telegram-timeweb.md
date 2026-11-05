# Развёртывание Telegram-сервера на Timeweb Cloud VPS

Выбранный первый вариант: российский VPS Timeweb Cloud с оплатой российской картой/СБП. Архитектура переносима: стандартные Docker Compose, Node.js, PostgreSQL и Caddy можно без изменения приложения поднять у другого VPS-провайдера.

## Что будет работать на VPS

- `app`: MoneyStat Sync Server и Telegram webhook.
- `db`: PostgreSQL с постоянным Docker volume.
- `caddy`: публичный HTTPS и автоматическое продление Let's Encrypt.

Финансовая база MoneyStat остаётся на устройстве. VPS хранит справочник счетов/категорий, диалоги бота и очередь ещё не загруженных операций.

## 1. Создать бота

1. В Telegram открыть официальный `@BotFather`.
2. Отправить `/newbot`, задать имя и username, оканчивающийся на `bot`.
3. Token сохранить в менеджере паролей. Не добавлять его в Git, скриншоты или переписку.
4. Получить числовые Telegram user ID членов семьи. Username (`@name`) не подходит для allowlist.

## 2. Создать VPS

1. Зарегистрироваться на <https://timeweb.cloud/> и пополнить баланс российской картой, СБП, SberPay или ЮMoney.
2. Создать облачный сервер из Marketplace с образом **Docker**, Ubuntu 24.04, российской локацией.
3. Для бота + PostgreSQL рекомендуется минимум 2 ГБ RAM и 20–40 ГБ NVMe. Один ГБ может работать, но оставляет мало запаса сборке и базе.
4. Включить автоматический backup/snapshot сервера либо настроить отдельный `pg_dump`.
5. Сохранить IP и SSH-доступ. Запретить вход по паролю после настройки SSH-ключа.

Официальные страницы: [VPS и способы оплаты](https://timeweb.cloud/services/vds-vps), [готовый Docker-образ](https://timeweb.cloud/marketplace).

## 3. Домен и HTTPS

Telegram webhook требует публичный HTTPS с валидным сертификатом. Нужен домен или поддомен, например `moneybot.example.ru`:

1. Зарегистрировать домен или использовать уже имеющийся.
2. Создать DNS `A`-запись поддомена на IPv4 VPS.
3. Дождаться обновления DNS и убедиться, что порты 80/443 разрешены firewall.
4. Caddy из [Caddyfile](../server/Caddyfile) автоматически выпустит и будет продлевать Let's Encrypt.

App Platform Timeweb выдаёт бесплатный технический домен и SSL, но требует внешнюю постоянную базу. Для более дешёвого единого VPS используем собственный домен/поддомен.

## 4. Загрузить проект

После подключения по SSH установить Git, если его нет, и клонировать репозиторий:

```bash
sudo apt update
sudo apt install -y git
git clone <URL-ВАШЕГО-РЕПОЗИТОРИЯ> MoneyStatApp
cd MoneyStatApp/server
cp .env.example .env
```

Если репозиторий приватный, используйте deploy key с доступом только на чтение. Не копируйте личный GitHub token в команды или `.env`.

## 5. Настроить секреты

Открыть `server/.env` на VPS и заполнить:

```dotenv
DOMAIN=moneybot.example.ru
POSTGRES_PASSWORD=ДЛИННЫЙ_СЛУЧАЙНЫЙ_ПАРОЛЬ_БЕЗ_СПЕЦСИМВОЛОВ
TELEGRAM_BOT_TOKEN=ТОКЕН_ОТ_BOTFATHER
TELEGRAM_WEBHOOK_SECRET=ДЛИННАЯ_URL_SAFE_СТРОКА
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
CORS_ALLOWED_ORIGINS=null,http://localhost,http://127.0.0.1:5173,http://localhost:5173
TRUST_PROXY=true
PAIR_CODE_TTL_SECONDS=600
RATE_LIMIT_PER_MINUTE=120
BODY_LIMIT_BYTES=65536
```

`DATABASE_URL`, `DATABASE_SSL`, `PORT` и `PUBLIC_BASE_URL` для контейнеров задаёт [compose.yaml](../server/compose.yaml). Пароль PostgreSQL должен быть длинным буквенно-цифровым, поскольку он включается во внутренний URL.

Секреты можно сгенерировать на VPS:

```bash
openssl rand -hex 32
```

Файл `.env` исключён из Git. Права:

```bash
chmod 600 .env
```

## 6. Запустить

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy
```

При каждом старте `app` безопасно применяет ещё не применённые SQL-миграции. После первого запуска установить webhook и меню команд:

```bash
docker compose run --rm app npm run webhook:set
```

Проверить:

```bash
curl https://moneybot.example.ru/healthz
```

Ожидается `{"ok":true}`. Если HTTPS ещё не готов, проверить DNS, открытые порты 80/443 и `docker compose logs caddy`.

## 7. Привязать MoneyStat

1. Разрешённый пользователь отправляет боту `/start` и получает 8-значный код на 10 минут.
2. В MoneyStat открыть `Настройки → Telegram-бот`.
3. Ввести `https://moneybot.example.ru` и код, нажать «Подключить Telegram».
4. Создать в боте тестовый расход через кнопки.
5. В MoneyStat нажать «Подгрузить из Telegram», проверить превью и подтвердить.
6. Проверить баланс и историю; затем удалить тестовую операцию в MoneyStat при необходимости.

## 8. Обновления и backup

Обновление:

```bash
cd ~/MoneyStatApp
git pull --ff-only
cd server
docker compose up -d --build
docker compose run --rm app npm run webhook:set
```

Backup PostgreSQL:

```bash
docker compose exec -T db pg_dump -U moneystat -d moneystat -Fc > moneystat-sync.dump
```

Хранить backup вне VPS. Перед удалением/переездом убедиться через `/status`, что очередь ожидающих операций пуста.

## 9. Минимальная защита VPS

- SSH-ключ вместо пароля; запрет root/password login после проверки ключа.
- Firewall: наружу только SSH, 80 и 443. PostgreSQL-порт 5432 не публикуется compose-файлом.
- Регулярные обновления Ubuntu и Docker; автоматические security updates.
- Backup базы и периодическая проверка восстановления.
- Не публиковать `.env`, Telegram token, device token и дампы базы.
- При компрометации token перевыпустить его через BotFather, обновить `.env`, перезапустить `app` и повторить `webhook:set`.

## 10. Переезд к другому VPS

1. Сделать `pg_dump` и backup `.env` в безопасное место.
2. На новом VPS клонировать репозиторий и перенести `.env`/dump.
3. Запустить compose, восстановить базу, направить DNS на новый IP.
4. Выполнить `webhook:set`, проверить `/healthz` и тестовую операцию.
5. Старый VPS выключать только после проверки очереди и основного приложения.
