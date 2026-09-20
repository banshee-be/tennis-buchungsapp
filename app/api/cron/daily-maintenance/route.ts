import { runDailyMaintenance } from "@/lib/maintenance";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const result = await runDailyMaintenance();
  return Response.json({ ok: true, ...result });
}
