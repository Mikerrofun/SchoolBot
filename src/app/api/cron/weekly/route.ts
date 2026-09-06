import type { NextRequest } from "next/server";
import { formatDate, weekRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";

/**
 * Runs every Sunday at 23:00 (see vercel.json).
 *
 * The active three-week window (previous / current / next) is always
 * computed from the current date, so it rolls over on its own and this
 * job is idempotent. Old lessons and homework are never deleted — the
 * database keeps the full history and the bot simply shows the window.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const [prevFrom, prevTo] = weekRange(-1, now);
  const [currFrom, currTo] = weekRange(0, now);
  const [nextFrom, nextTo] = weekRange(1, now);

  console.log(
    `[v0] weekly window: prev ${formatDate(prevFrom)}–${formatDate(prevTo)}, ` +
      `curr ${formatDate(currFrom)}–${formatDate(currTo)}, ` +
      `next ${formatDate(nextFrom)}–${formatDate(nextTo)}`
  );

  return Response.json({
    ok: true,
    window: {
      previous: [formatDate(prevFrom), formatDate(prevTo)],
      current: [formatDate(currFrom), formatDate(currTo)],
      next: [formatDate(nextFrom), formatDate(nextTo)],
    },
  });
}
