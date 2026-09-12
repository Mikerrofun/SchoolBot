# SchoolBot — Class Homework Bot

Telegram-бот класса: расписание и домашние задания на прошлую, текущую и следующую неделю. ДЗ привязано к конкретному уроку конкретного дня. При добавлении ДЗ AI (OpenRouter) сравнивает новое с существующим и убирает дубли.

Стек: Next.js · TypeScript · Prisma · PostgreSQL (Supabase) · grammY · OpenRouter.

## Настройка

1. **База данных** — создайте PostgreSQL (Supabase) и задайте `DATABASE_URL` в `.env` (шаблон — `.env.example`).
2. **Миграции и сид**:
   ```bash
   npx prisma migrate dev --name init
   pnpm db:seed
   ```
3. **Telegram** — создайте бота у @BotFather, задайте `TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` (любая случайная строка).
4. **Webhook** — после деплоя:
   ```bash
   pnpm bot:set-webhook https://your-app.vercel.app
   ```
5. **AI** — ключ с https://openrouter.ai/keys в `OPENROUTER_API_KEY`. Не обязателен: без него бот работает, просто сохраняет ДЗ без дедупликации.
6. **Админы** — ID через запятую в `ADMIN_TELEGRAM_IDS`; они подтверждают новое ДЗ (при `same=false`).

## Команды бота

- `/start` — главное меню
- `/расписание` — расписание выбранной недели
- `/дз` — просмотр ДЗ: неделя → день → все уроки дня одним сообщением (пустые — «—»)
- `/добавить` — запись ДЗ: неделя → день → урок → текст; если ДЗ отличается от прошлой недели (`same=false`) — уходит админу на подтверждение
- «Дополнительно» — шестой раздел в меню: просмотр за неделю и заполнение по дням, сохраняется сразу

## Структура

```
src/
├── app/api/telegram/webhook   # приём обновлений Telegram (grammY)
├── bot/                       # bot.ts, keyboards, handlers, messages
├── services/                  # schedule.service, homework.service, additional.service
├── lib/                       # prisma, weeks (окно 3 недель), ai (OpenRouter), admin
prisma/schema.prisma           # Lesson (дата + номер + предмет), Homework, AdditionalHomework
```
