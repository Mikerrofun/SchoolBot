# 🚀 Быстрый старт — SchoolBot

## Архитектура бота

**SchoolBot работает в режиме webhook**, а не polling:
- Telegram отправляет обновления (сообщения, нажатия кнопок) на ваш сервер
- Next.js обрабатывает их через API route: `/api/telegram/webhook`
- Бот инициализируется через `grammY` библиотеку при получении обновления

**Это значит:** бот **не запускается отдельно** — он живёт внутри Next.js приложения.

---

## 📋 Предварительные требования

- **Node.js** (v18+) и **pnpm** (или npm)
- **PostgreSQL база данных** (рекомендуется Supabase для production)
- **Telegram бот токен** от [@BotFather](https://t.me/BotFather)
- **ngrok** (для локальной разработки) — [установка](https://ngrok.com/download)

---

## 🛠️ Локальная разработка

### 1. Установите зависимости

```bash
pnpm install
# или
npm install
```

### 2. Настройте `.env`

Создайте файл `.env` из примера:

```bash
cp .env.example .env
```

Заполните минимальные переменные:

```env
# База данных (локально можно использовать PostgreSQL в Docker)
DATABASE_URL="postgresql://user:password@localhost:5432/schoolbot"

# Telegram бот (получите у @BotFather)
TELEGRAM_BOT_TOKEN="ваш_токен_от_BotFather"

# Секретный токен для защиты webhook (любая случайная строка)
TELEGRAM_WEBHOOK_SECRET="любая_случайная_строка_минимум_20_символов"

# OpenRouter API (опционально, для AI дедупликации)
OPENROUTER_API_KEY=""

# Админы (Telegram ID через запятую)
ADMIN_TELEGRAM_IDS="123456789,987654321"
```

**Как узнать свой Telegram ID:**
- Напишите [@userinfobot](https://t.me/userinfobot)

### 3. Инициализируйте базу данных

```bash
# Создайте миграции и сгенерируйте Prisma Client
pnpm db:migrate

# Заполните тестовыми данными (расписание на 3 недели)
pnpm db:seed
```

### 4. Запустите Next.js сервер

```bash
pnpm dev
```

Сервер запустится на `http://localhost:3000`

### 5. Настройте ngrok для локального тестирования

В **отдельном терминале** запустите ngrok:

```bash
ngrok http 3000
```

Скопируйте **HTTPS URL** (например: `https://abc123.ngrok-free.app`)

### 6. Установите webhook

**Вариант A: Через curl (быстро)**

```bash
curl -X POST "https://api.telegram.org/bot<ВАШ_ТОКЕН>/setWebhook" \
  -d "url=https://<ВАШ_NGROK_URL>/api/telegram/webhook" \
  -d "secret_token=<ВАШ_TELEGRAM_WEBHOOK_SECRET>"
```

**Пример:**
```bash
curl -X POST "https://api.telegram.org/bot5GJv0w...PBV12/setWebhook" \
  -d "url=https://abc123.ngrok-free.app/api/telegram/webhook" \
  -d "secret_token=моя_секретная_строка"
```

**Вариант B: Через npm скрипт**

Отредактируйте `scripts/set-webhook.ts` и запустите:

```bash
pnpm bot:set-webhook
```

### 7. Проверьте webhook

```bash
pnpm bot:info
```

Вы должны увидеть:
```json
{
  "ok": true,
  "result": {
    "url": "https://abc123.ngrok-free.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 8. Протестируйте бота

Найдите своего бота в Telegram и напишите `/start` 🎉

---

## 🔄 Workflow локальной разработки

1. **Запустите Next.js:** `pnpm dev` (терминал 1)
2. **Запустите ngrok:** `ngrok http 3000` (терминал 2)
3. **При каждом перезапуске ngrok** URL меняется → нужно заново установить webhook
4. **Для остановки webhook:**
   ```bash
   pnpm bot:delete-webhook
   ```

---

## 🚀 Production деплой

См. полную инструкцию в **[DEPLOYMENT.md](./DEPLOYMENT.md)**

**Кратко:**

1. **Задайте переменные окружения** на хостинге (Vercel/Railway/etc.)
2. **Деплой:**
   ```bash
   pnpm build
   pnpm start:prod
   ```
3. **Установите webhook на production URL:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<ТОКЕН>/setWebhook" \
     -d "url=https://your-app.vercel.app/api/telegram/webhook" \
     -d "secret_token=<СЕКРЕТ>"
   ```

---

## 📚 Полезные команды

```bash
# База данных
pnpm db:generate      # Генерация Prisma Client
pnpm db:migrate       # Создание/применение миграций
pnpm db:deploy        # Применение миграций (production)
pnpm db:seed          # Заполнение тестовыми данными
pnpm db:studio        # Prisma Studio (GUI для БД)

# Бот
pnpm bot:info         # Информация о webhook
pnpm bot:delete-webhook  # Удалить webhook

# Разработка
pnpm dev              # Запуск dev сервера
pnpm build            # Сборка для production
pnpm start            # Запуск production сборки
```

---

## ❓ Частые проблемы

### Бот не отвечает

1. **Проверьте webhook:**
   ```bash
   pnpm bot:info
   ```
   - `url` должен быть вашим ngrok URL + `/api/telegram/webhook`
   - `pending_update_count` должен быть 0

2. **Проверьте логи Next.js** — они покажут ошибки при обработке webhook

3. **Проверьте ngrok** — он должен быть запущен и показывать запросы от Telegram

### 401 Unauthorized при webhook

- **Причина:** `TELEGRAM_WEBHOOK_SECRET` в `.env` не совпадает с тем, что вы указали при `setWebhook`
- **Решение:** Убедитесь, что секрет одинаковый в обоих местах

### База данных не подключается

- **Локально:** Убедитесь, что PostgreSQL запущен
- **Production:** Проверьте `DATABASE_URL` в переменных окружения хостинга

### ngrok URL изменился

При каждом перезапуске ngrok даёт новый URL. Нужно заново запустить `setWebhook` с новым URL.

**Лайфхак:** используйте платный ngrok с фиксированным доменом или деплойте на Vercel для постоянного URL.

---

## 🎯 Следующие шаги

- 📖 Изучите [архитектуру проекта](./architecture.md)
- 🗂️ Познакомьтесь с [моделью данных](./data-model.md)
- 🤖 Узнайте, как работает [AI дедупликация](./ai-deduplication.md)
- 🚀 Настройте [production деплой](./deployment.md)

---

**Приятной разработки! 🎓**
