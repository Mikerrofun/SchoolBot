# SchoolBot — Class Homework Bot

Telegram-бот класса: расписание и домашние задания на прошлую, текущую и следующую неделю. ДЗ привязано к конкретному уроку конкретного дня. При добавлении ДЗ AI (OpenRouter) сравнивает новое с существующим и убирает дубли.

Стек: Next.js · TypeScript · Prisma · PostgreSQL (Supabase) · grammY · OpenRouter.

## Документация

| Документ | Для кого | О чём |
|---|---|---|
| [Руководство пользователя](./docs/user-guide.md) | Ученики, родители, админы | Как пользоваться ботом: меню, расписание, ДЗ, «Дополнительно», модерация |
| [Индекс документации](./docs/README.md) | Разработчики | Обзор всех документов проекта |
| [Архитектура](./docs/ARCHITECTURE.md) | Разработчики | Слои, поток данных от Telegram до БД и обратно |
| [Модель данных](./docs/data-model.md) | Разработчики | Схема Prisma, ключевые решения |
| [Поток данных](./docs/data-flow.md) | Разработчики | Пошаговые разборы сценариев с кодом |
| [Telegram-бот](./docs/telegram-bot.md) | Разработчики | grammY, сессии, клавиатуры, callback-схемы |
| [AI-дедупликация](./docs/ai-deduplication.md) | Разработчики | Сравнение ДЗ через OpenRouter, деградация без AI |
| [Развёртывание](./docs/deployment.md) | DevOps | Переменные окружения, миграции, seed, webhook |
| [Быстрый старт](./docs/quick-start.md) | Разработчики | Локальная разработка |

## Быстрый старт

### Локальная разработка

1. **Клонируйте репозиторий**
   ```bash
   git clone <repo-url>
   cd SchoolBot
   ```

2. **Установите зависимости**
   ```bash
   pnpm install
   ```

3. **Настройте `.env`**
   ```bash
   cp .env.example .env
   # Заполните: DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
   ```

4. **Инициализируйте БД**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **Запустите dev сервер**
   ```bash
   pnpm dev
   ```

### Production деплой

См. подробную инструкцию в **[docs/deployment.md](./docs/deployment.md)**

**Кратко:**
```bash
# 1. Задайте переменные окружения на хостинге
# 2. Деплой (команды сборки):
pnpm build     # или vercel-build для Vercel
pnpm start:prod

# 3. Настройте webhook:
pnpm bot:set-webhook https://your-app.vercel.app
```

### Переменные окружения

- `DATABASE_URL` — PostgreSQL (Supabase)
- `TELEGRAM_BOT_TOKEN` — токен от @BotFather
- `TELEGRAM_WEBHOOK_SECRET` — любая случайная строка для безопасности
- `OPENROUTER_API_KEY` — (опционально) для AI дедупликации ДЗ
- `ADMIN_TELEGRAM_IDS` — ID админов через запятую (одобряют ДЗ)
- `SCHOOL_TIMEZONE` — (опционально) часовой пояс школы, по умолчанию `Europe/Moscow`

## Команды бота

- `/start` — главное меню
- `/расписание` — расписание текущей недели
- `/дз` — просмотр ДЗ: неделя → день → все уроки дня одним сообщением (пустые — «—»)
- `/добавить` — запись ДЗ: неделя → день → урок → текст; если ДЗ отличается от прошлой недели (`same=false`) — уходит админу на подтверждение
- «Дополнительно» — шестой раздел в меню: просмотр за неделю и заполнение по дням, сохраняется сразу

## Структура

```
src/
├── app/api/telegram/webhook   # приём обновлений Telegram (grammY)
├── bot/                       # bot.ts, keyboards, handlers, messages
├── config/schedule.ts         # статичное расписание + сплит-группы (SPLIT_GROUPS)
├── services/                  # schedule.service, homework.service, additional.service
├── lib/                       # prisma, weeks (окно 3 недель), ai (OpenRouter), admin
prisma/schema.prisma           # Lesson (дата + номер + предмет), Homework, AdditionalHomework
```
