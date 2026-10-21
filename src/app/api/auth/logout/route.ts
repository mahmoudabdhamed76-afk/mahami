import { api, body, json } from "@/server/http";
import { currentUser, endSession } from "@/server/auth";

export const POST = api(async (req) => {
  const { all } = (await body(req)) as { all?: boolean };
  const user = all ? await currentUser() : null;
  await endSession(!!all, user?.id);
  return json({ ok: true });
});
