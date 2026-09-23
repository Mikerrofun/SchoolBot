# 🚀 Руководство по развертыванию SchoolBot

## 📋 Содержание
1. [Требования к системе](#требования-к-системе)
2. [Установка зависимостей](#установка-зависимостей)
3. [Настройка переменных окружения](#настройка-переменных-окружения)
4. [Настройка базы данных](#настройка-базы-данных)
5. [Режимы запуска бота](#режимы-запуска-бота)
6. [Развертывание в продакшене](#развертывание-в-продакшене)
7. [Полезные команды](#полезные-команды)

---

## 📦 Требования к системе

### Необходимые версии:
- **Node.js**: `>= 18.17.0` (рекомендуется `20.x` или `22.x`)
- **npm/pnpm**: `npm >= 9.x` или `pnpm >= 8.x`
- **PostgreSQL**: `>= 14.x`
- **Prisma**: `^6.16.2` (автоматически устанавливается)

### Проверка установленных версий:
```bash
node --version
npm --version
pnpm --version  # если используете pnpm
psql --version
```

---

## 🔧 Установка зависимостей

### Вариант 1: С использованием npm
```bash
npm install
```

### Вариант 2: С использованием pnpm (рекомендуется для продакшена)
```bash
pnpm install
```

> **Примечание**: После установки автоматически выполнится `prisma generate` (см. `postinstall` в `package.json`)

---

## 🔑 Настройка переменных окружения

### 1. Скопируйте файл примера:
```bash
cp .env.example .env
```

### 2. Заполните переменные в `.env`:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:5432/schoolbot"

# Telegram Bot Token (получите у @BotFather)
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"

# OpenRouter API Key (для AI-функций)
OPENROUTER_API_KEY="sk-or-v1-..."

# Секрет для проверки webhook (любая случайная строка 1-256 символов)
TELEGRAM_WEBHOOK_SECRET="my_super_secret_webhook_token_12345"

# ID администраторов (через запятую)
ADMIN_TELEGRAM_IDS="123456789,987654321"
```

### Как получить необходимые данные:

#### **Telegram Bot Token:**
1. Напишите [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot` и следуйте инструкциям
3. Скопируйте полученный токен

#### **OpenRouter API Key:**
1. Зарегистрируйтесь на [openrouter.ai](https://openrouter.ai)
2. Перейдите в [Keys](https://openrouter.ai/keys)
3. Создайте новый ключ

#### **Database URL (Supabase):**
1. Создайте проект на [supabase.com](https://supabase.com)
2. Project Settings → Database → Connection string
3. Выберите режим "Transaction" или "Session"

#### **Admin Telegram IDs:**
1. Напишите боту [@userinfobot](https://t.me/userinfobot)
2. Скопируйте ваш ID

---

## 🗄️ Настройка базы данных

### 1. Генерация Prisma Client:
```bash
npm run db:generate
# или
pnpm db:generate
```

### 2. Применение миграций (development):
```bash
npm run db:migrate
# или
pnpm db:migrate
```

### 3. Применение миграций (production):
```bash
npm run db:deploy
# или
pnpm db:deploy
```

### 4. Заполнение начальными данными (seed):
```bash
npm run db:seed
# или
pnpm db:seed
```

### 5. Открыть Prisma Studio (GUI для БД):
```bash
npm run db:studio
# или
pnpm db:studio
```

### Полная настройка БД с нуля:
```bash
# 1. Генерация клиента
npm run db:generate

# 2. Применение миграций
npm run db:deploy

# 3. Заполнение данными
npm run db:seed
```

---

## 🤖 Режимы запуска бота

### 🔵 Режим 1: Long Polling (для разработки)

**Когда использовать:** Локальная разработка, тестирование без публичного URL.

#### Запуск:
```bash
npm run bot:dev
# или
pnpm bot:dev
```

#### Перед запуском нужно удалить webhook:
```bash
npm run bot:delete-webhook
# или
pnpm bot:delete-webhook
```

#### Полная последовательность:
```bash
# 1. Удалить webhook (если был установлен)
npm run bot:delete-webhook

# 2. Запустить бота в режиме polling
npm run bot:dev
```

---

### 🟢 Режим 2: Webhook (для продакшена)

**Когда использовать:** Развертывание на сервере с публичным доменом (Vercel, Railway, VPS и т.д.).

#### 1. Установить webhook:
```bash
npm run bot:set-webhook
# или
pnpm bot:set-webhook
```

> Скрипт автоматически установит webhook на `https://ваш-домен.com/api/telegram/webhook`

#### 2. Запустить Next.js сервер:

**Development:**
```bash
npm run dev
# или
pnpm dev
```

**Production:**
```bash
# Сборка
npm run build

# Запуск
npm run start:prod
```

#### 3. Проверить статус webhook:
```bash
npm run bot:info
# или
pnpm bot:info
```

#### Пример вывода:
```json
{
  "ok": true,
  "result": {
    "url": "https://your-domain.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0
  }
}
```

---

## 🌐 Развертывание в продакшене

### Вариант 1: Vercel (рекомендуется)

#### 1. Установите Vercel CLI:
```bash
npm install -g vercel
```

#### 2. Войдите в аккаунт:
```bash
vercel login
```

#### 3. Разверните проект:
```bash
vercel
```

#### 4. Добавьте переменные окружения через Vercel Dashboard:
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `OPENROUTER_API_KEY`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_TELEGRAM_IDS`

#### 5. Установите webhook:
```bash
# После получения URL от Vercel
npm run bot:set-webhook
```

#### Автоматический деплой:
```bash
# Vercel автоматически выполнит:
# 1. npm install
# 2. prisma generate
# 3. prisma migrate deploy
# 4. next build
```

---

### Вариант 2: Railway

#### 1. Установите Railway CLI:
```bash
npm install -g @railway/cli
```

#### 2. Войдите в аккаунт:
```bash
railway login
```

#### 3. Инициализируйте проект:
```bash
railway init
```

#### 4. Добавьте PostgreSQL:
```bash
railway add postgresql
```

#### 5. Разверните:
```bash
railway up
```

#### 6. Установите переменные окружения через Railway Dashboard

#### 7. Установите webhook:
```bash
npm run bot:set-webhook
```

---

### Вариант 3: VPS (Ubuntu/Debian)

#### 1. Подключитесь к серверу:
```bash
ssh user@your-server.com
```

#### 2. Установите Node.js (через nvm):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

#### 3. Установите PostgreSQL:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

#### 4. Клонируйте репозиторий:
```bash
git clone https://github.com/your-username/schoolbot.git
cd schoolbot
```

#### 5. Установите зависимости:
```bash
npm install
```

#### 6. Настройте `.env` файл

#### 7. Настройте БД:
```bash
npm run db:deploy
npm run db:seed
```

#### 8. Соберите проект:
```bash
npm run build
```

#### 9. Запустите с PM2:
```bash
# Установите PM2
npm install -g pm2

# Запустите приложение
pm2 start npm --name "schoolbot" -- run start:prod

# Сохраните конфигурацию
pm2 save

# Автозапуск при перезагрузке
pm2 startup
```

#### 10. Настройте Nginx (опционально):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 11. Установите SSL с Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 12. Установите webhook:
```bash
npm run bot:set-webhook
```

---

## 🛠️ Полезные команды

### Prisma:
```bash
# Генерация клиента
npm run db:generate

# Миграция (dev)
npm run db:migrate

# Миграция (prod)
npm run db:deploy

# Заполнение данными
npm run db:seed

# Prisma Studio
npm run db:studio
```

### Telegram Bot:
```bash
# Информация о webhook
npm run bot:info

# Установить webhook
npm run bot:set-webhook

# Удалить webhook
npm run bot:delete-webhook

# Запуск в режиме polling (dev)
npm run bot:dev
```

### Next.js:
```bash
# Разработка
npm run dev

# Сборка
npm run build

# Запуск production
npm run start

# Запуск с миграциями
npm run start:prod
```

### Проверка состояния:
```bash
# Проверить конфигурацию webhook
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo

# Проверить здоровье приложения
curl https://your-domain.com/api/health

# Просмотр логов (PM2)
pm2 logs schoolbot

# Перезапуск (PM2)
pm2 restart schoolbot
```

---

## 🔄 Обновление проекта

### На VPS:
```bash
# 1. Получить изменения
git pull origin main

# 2. Установить новые зависимости
npm install

# 3. Применить миграции
npm run db:deploy

# 4. Пересобрать
npm run build

# 5. Перезапустить
pm2 restart schoolbot
```

### На Vercel/Railway:
```bash
# Просто push в репозиторий
git push origin main

# Платформа автоматически:
# - установит зависимости
# - применит миграции
# - соберет проект
# - задеплоит
```

---

## 🐛 Troubleshooting

### Проблема: "Webhook is already set"
```bash
# Удалите webhook и установите заново
npm run bot:delete-webhook
npm run bot:set-webhook
```

### Проблема: "Can't find Prisma Client"
```bash
# Перегенерируйте клиент
npm run db:generate
```

### Проблема: "Database connection failed"
```bash
# Проверьте DATABASE_URL
echo $DATABASE_URL

# Проверьте доступность БД
psql $DATABASE_URL -c "SELECT 1"
```

### Проблема: "Webhook returns 401"
```bash
# Проверьте TELEGRAM_WEBHOOK_SECRET в .env
# Он должен совпадать с тем, что используется в коде
```

---

## 📊 Мониторинг

### Логи Telegram:
```bash
# Получить обновления вручную
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

### Проверка БД:
```bash
# Подключиться к БД
psql $DATABASE_URL

# Проверить таблицы
\dt

# Проверить количество записей
SELECT COUNT(*) FROM "Homework";
SELECT COUNT(*) FROM "Lesson";
SELECT COUNT(*) FROM "User";
```

---

## 🎯 Быстрый старт (TL;DR)

### Локальная разработка:
```bash
# 1. Установка
npm install

# 2. Настройка
cp .env.example .env
# Отредактируйте .env

# 3. База данных
npm run db:deploy
npm run db:seed

# 4. Запуск бота (polling)
npm run bot:delete-webhook
npm run bot:dev
```

### Production (Vercel):
```bash
# 1. Установка Vercel CLI
npm install -g vercel

# 2. Деплой
vercel

# 3. Добавьте env variables в Vercel Dashboard

# 4. Установите webhook
npm run bot:set-webhook

# 5. Проверьте
npm run bot:info
```

---

## 📚 Дополнительные ресурсы

- [Документация Prisma](https://www.prisma.io/docs)
- [Документация Next.js](https://nextjs.org/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Grammy Framework](https://grammy.dev/)
- [OpenRouter API](https://openrouter.ai/docs)

---

**Успешного развертывания! 🚀**
