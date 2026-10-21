import { after } from "next/server";
import { api, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { pullChanges } from "@/server/sync";
import { maybeRunReminders } from "@/server/scheduler";

export const GET = api(async (req) => {
  const user = await requireUser();
  const since = Number(new URL(req.url).searchParams.get("since") ?? 0) || 0;
  after(() => maybeRunReminders());
  return json(await pullChanges(user.id, since));
});
