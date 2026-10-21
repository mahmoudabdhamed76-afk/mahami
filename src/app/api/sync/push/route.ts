import { api, body, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { applyOps } from "@/server/sync";
import { pushBody } from "@/lib/schemas";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { ops, clientNow } = pushBody.parse(await body(req));
  return json(await applyOps(user.id, ops, clientNow));
});
