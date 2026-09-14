# 🚀 Чеклист деплоя SchoolBot

## ✅ Перед деплоем

### 1. Переменные окружения на хостинге
- [ ] `DATABASE_URL` — PostgreSQL connection string
- [ ] `TELEGRAM_BOT_TOKEN` — токен от @BotFather
- [ ] `TELEGRAM_WEBHOOK_SECRET` — случайная строка (та же что в локальном .env)
- [ ] `OPENROUTER_API_KEY` — (опционально) для AI
- [ ] `ADMIN_TELEGRAM_IDS` — ID админов через запятую

### 2. База данных (PostgreSQL)
- [ ] Создана база данных (Supabase / Railway / Neon)
- [ ] `DATABASE_URL` корректный
- [ ] Доступ из интернета открыт

### 3. Git
- [ ] Все изменения закоммичены
- [ ] `prisma/migrations/` в репозитории
- [ ] `.env` в `.gitignore` (не коммитить!)

### 4. Конфигурация хостинга

#### Vercel
- [ ] Build Command: `vercel-build` (или пусто)
- [ ] Install Command: `pnpm install`
- [ ] Root Directory: `./` (корень проекта)

#### Railway / Render
- [ ] Build Command: `pnpm build`
- [ ] Start Command: `pnpm start:prod`
- [ ] Node Version: 18+

#### VPS (Digital Ocean, AWS, и т.д.)
- [ ] Node.js 18+ установлен
- [ ] pnpm установлен: `npm install -g pnpm`
- [ ] PM2 установлен: `npm install -g pm2`

---

## 🛠 После деплоя

### 1. Проверить сборку
- [ ] Деплой завершился успешно
- [ ] Нет ошибок в логах сборки
- [ ] Prisma Client сгенерирован
- [ ] Миграции применились

### 2. Проверить приложение
- [ ] Сайт открывается: `https://your-app.vercel.app`
- [ ] Webhook endpoint отвечает: `https://your-app.vercel.app/api/telegram/webhook`
  ```bash
  curl https://your-app.vercel.app/api/telegram/webhook
  # Ответ: "Telegram webhook endpoint"
  ```

### 3. Настроить webhook
```bash
# Установить
pnpm bot:set-webhook https://your-app.vercel.app

# Или автоматически (если VERCEL_URL задан)
pnpm bot:set-webhook

# Проверить
pnpm bot:info
```

**Ожидаемый результат:**
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

### 4. Проверить бота
- [ ] Найти бота в Telegram
- [ ] Отправить `/start`
- [ ] Получить главное меню с кнопками:
  - 📚 Расписание
  - 📝 Домашнее задание
  - ✍️ Добавить ДЗ
  - ➕ Дополнительно

### 5. Проверить функционал
- [ ] Расписание загружается (прошлая/текущая/следующая неделя)
- [ ] ДЗ отображается
- [ ] Добавление ДЗ работает
- [ ] Админские права работают (если вы админ)

---

## 🔥 Проблемы и решения

### ❌ Бот не отвечает
```bash
# 1. Проверить webhook
pnpm bot:info

# 2. Переустановить webhook
pnpm bot:delete-webhook
pnpm bot:set-webhook https://your-app.vercel.app

# 3. Проверить логи сервера (Vercel / Railway)
```

### ❌ 401 Unauthorized
**Причина:** `TELEGRAM_WEBHOOK_SECRET` не совпадает

**Решение:**
1. Проверить что переменная задана на хостинге
2. Переустановить webhook: `pnpm bot:set-webhook`

### ❌ 503 Service Unavailable
**Причина:** `TELEGRAM_BOT_TOKEN` не задан

**Решение:**
1. Добавить переменную на хостинге
2. Перезапустить приложение

### ❌ Prisma Client не найден
**Причина:** `prisma generate` не выполнился при сборке

**Решение:**
```bash
# Локально
pnpm db:generate

# На хостинге - проверить что в package.json есть:
# "postinstall": "prisma generate"
```

### ❌ Таблицы не созданы
**Причина:** Миграции не применились

**Решение:**
```bash
# Проверить статус
npx prisma migrate status

# Применить вручную
pnpm db:deploy
```

---

## 📊 Команды для мониторинга

### Логи (Vercel)
```bash
vercel logs your-app-name --follow
```

### Логи (Railway)
```
# В веб-интерфейсе Railway -> Deploy -> Logs
```

### Логи (PM2)
```bash
pm2 logs schoolbot
pm2 monit
```

### Статус webhook
```bash
pnpm bot:info
```

### Просмотр БД
```bash
pnpm db:studio
# Откроется http://localhost:5555
```

---

## 🎯 Финальная проверка

Если всё работает:
- ✅ Webhook установлен (`pnpm bot:info` показывает правильный URL)
- ✅ Бот отвечает на `/start`
- ✅ Расписание загружается
- ✅ ДЗ добавляется и отображается
- ✅ Нет ошибок в логах

**Готово! 🎉 Бот работает в продакшене.**
