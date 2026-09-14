# Инструкция по деплою SchoolBot

## Команды для сборки и запуска

### Локальная разработка
```bash
# Установка зависимостей
pnpm install

# Запуск миграций БД (dev)
pnpm db:migrate

# Заполнение начальными данными
pnpm db:seed

# Запуск dev сервера
pnpm dev
```

### Production сборка (универсальная)
```bash
# 1. Установка зависимостей
pnpm install

# 2. Сборка (генерирует Prisma Client + мигрирует БД + собирает Next.js)
pnpm build

# 3. Запуск (применяет миграции если нужно + стартует сервер)
pnpm start:prod
```

### Для Vercel (автоматически)
Vercel использует специальную команду `vercel-build`:
```bash
pnpm vercel-build
```

## Настройка на хостинге

### 1. Переменные окружения

**Обязательные:**
```env
DATABASE_URL=postgresql://user:password@host:5432/schoolbot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=any_random_string_here_123456
```

**Дополнительные:**
```env
# AI дедупликация (опционально)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Админы (ID через запятую)
ADMIN_TELEGRAM_IDS=123456789,987654321

# Для Vercel (автоматически)
VERCEL_URL=your-app.vercel.app
```

### 2. Команды сборки по платформам

#### Vercel
- **Build Command:** `pnpm vercel-build` или оставить пустым (использует package.json)
- **Install Command:** `pnpm install`
- **Start Command:** (не нужно, Vercel автоматически использует `next start`)

#### Railway / Render / Fly.io
- **Build Command:** `pnpm build`
- **Start Command:** `pnpm start:prod`

#### VPS (Digital Ocean, AWS EC2, и т.д.)
```bash
# Клонирование
git clone <repo-url>
cd SchoolBot

# Установка зависимостей
pnpm install

# Настройка .env
cp .env.example .env
nano .env  # заполните переменные

# Сборка
pnpm build

# Запуск через PM2 (рекомендуется)
pm2 start "pnpm start:prod" --name schoolbot
pm2 save
pm2 startup
```

### 3. После деплоя - настройка Webhook

**Автоматически (если задан VERCEL_URL или TELEGRAM_WEBHOOK_URL):**
```bash
pnpm bot:set-webhook
```

**Вручную (указать URL):**
```bash
pnpm bot:set-webhook https://your-app.vercel.app
```

**Проверить статус webhook:**
```bash
pnpm bot:info
```

**Удалить webhook (для тестирования локально):**
```bash
pnpm bot:delete-webhook
```

## Проверка работы

### 1. Проверить что Next.js запустился
```bash
curl https://your-app.vercel.app/api/telegram/webhook
# Ответ: "Telegram webhook endpoint"
```

### 2. Проверить webhook
```bash
pnpm bot:info
```
Должно быть:
```json
{
  "ok": true,
  "result": {
    "url": "https://your-app.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 3. Проверить бота в Telegram
Отправьте `/start` боту — должно прийти главное меню.

## Troubleshooting

### Prisma Client не генерируется
**Проблема:** `@prisma/client did not initialize yet`

**Решение:**
```bash
pnpm db:generate
```
Убедитесь что в `package.json` есть `"postinstall": "prisma generate"`

### Миграции не применяются
**Проблема:** Таблицы не создаются в БД

**Решение:**
```bash
# Для production
pnpm db:deploy

# Или проверить вручную
npx prisma migrate status
```

### Бот не отвечает
**Проблема:** Бот онлайн, но не реагирует на команды

**Возможные причины:**
1. Webhook не настроен: `pnpm bot:set-webhook`
2. TELEGRAM_WEBHOOK_SECRET не совпадает
3. DATABASE_URL неправильный
4. Ошибки в логах сервера

### 503 Service Unavailable
**Проблема:** Webhook возвращает 503

**Решение:**
Проверьте что `TELEGRAM_BOT_TOKEN` задан на хостинге:
```bash
# Локально
echo $TELEGRAM_BOT_TOKEN

# На хостинге - зайти в настройки Environment Variables
```

## Полезные команды

```bash
# Просмотр БД через GUI
pnpm db:studio

# Линтинг
pnpm lint

# Просмотр логов (PM2)
pm2 logs schoolbot

# Перезапуск (PM2)
pm2 restart schoolbot

# Остановка (PM2)
pm2 stop schoolbot
```

## Структура команд в package.json

| Команда | Описание |
|---------|----------|
| `dev` | Локальная разработка |
| `build` | Production сборка (Prisma + миграции + Next.js) |
| `start` | Запуск Next.js сервера |
| `start:prod` | Production запуск (миграции + старт) |
| `db:generate` | Генерация Prisma Client |
| `db:migrate` | Создание миграции (dev) |
| `db:deploy` | Применение миграций (prod) |
| `db:seed` | Заполнение тестовыми данными |
| `db:studio` | GUI для просмотра БД |
| `bot:set-webhook` | Установка webhook |
| `bot:info` | Информация о webhook |
| `bot:delete-webhook` | Удаление webhook |
| `vercel-build` | Специальная команда для Vercel |
| `postinstall` | Автоматически после `pnpm install` |

## Важно!

1. **После каждого деплоя** проверяй `pnpm bot:info` — URL должен быть актуальным
2. **TELEGRAM_WEBHOOK_SECRET** должен быть одинаковым в `.env` и при вызове `setWebhook`
3. **DATABASE_URL** должен быть production база, не локальная
4. **Миграции** должны быть закоммичены в git (папка `prisma/migrations/`)
