import { formatDate, weekRange } from "@/lib/weeks";

const COMMANDS = [
  { cmd: "/start", desc: "Главное меню бота" },
  { cmd: "/расписание", desc: "Расписание выбранной недели" },
  { cmd: "/дз", desc: "Домашнее задание: неделя → день → урок" },
  { cmd: "/добавить", desc: "Записать новое ДЗ за три шага" },
];

const STEPS = [
  {
    title: "Выбрал неделю",
    text: "Прошлая, текущая или следующая — бот всегда держит активными три недели.",
  },
  {
    title: "Выбрал день и урок",
    text: "ДЗ привязано к конкретному уроку конкретного дня, а не просто к предмету.",
  },
  {
    title: "Записал ДЗ",
    text: "AI сравнивает новое ДЗ с существующим и убирает дубли, оставляя одну понятную формулировку.",
  },
];

function EnvStatus({ name, ok }: { name: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <code className="font-mono text-sm text-foreground">{name}</code>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          ok
            ? "bg-accent-soft text-accent"
            : "bg-border text-muted"
        }`}
      >
        {ok ? "задан" : "не задан"}
      </span>
    </li>
  );
}

export default function Home() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    TELEGRAM_WEBHOOK_SECRET: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
  };

  const [currFrom, currTo] = weekRange(0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-14">
        <p className="mb-3 font-mono text-sm text-primary">
          {formatDate(currFrom)} – {formatDate(currTo)} · текущая неделя
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          Class Homework Bot
        </h1>
        <p className="mt-4 max-w-xl text-pretty leading-relaxed text-muted">
          Telegram-бот класса, который хранит расписание и домашние задания на
          прошлую, текущую и следующую неделю — в одном месте и без дублей.
        </p>
      </header>

      <section className="mb-14 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-3 font-mono text-xs text-primary">
              шаг {i + 1}
            </div>
            <h2 className="mb-2 font-medium">{step.title}</h2>
            <p className="text-sm leading-relaxed text-muted">{step.text}</p>
          </div>
        ))}
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Команды бота</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {COMMANDS.map((c) => (
            <li key={c.cmd} className="flex items-baseline gap-4 px-5 py-3.5">
              <code className="font-mono text-sm text-primary">{c.cmd}</code>
              <span className="text-sm text-muted">{c.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Настройка окружения</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card px-5">
          {Object.entries(env).map(([name, ok]) => (
            <EnvStatus key={name} name={name} ok={ok} />
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Переменные берутся из <code className="font-mono">.env</code> (см.{" "}
          <code className="font-mono">.env.example</code>). После подключения
          базы выполните{" "}
          <code className="font-mono">npx prisma migrate dev</code> и{" "}
          <code className="font-mono">pnpm db:seed</code>, затем установите
          webhook командой{" "}
          <code className="font-mono">pnpm bot:set-webhook</code>.
        </p>
      </section>
    </main>
  );
}
