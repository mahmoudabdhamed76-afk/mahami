import { api, json, rateLimit } from "@/server/http";
import { requireUser } from "@/server/auth";
import { sendToUser } from "@/server/push";

export const POST = api(async () => {
  const user = await requireUser();
  rateLimit(`pushtest:${user.id}`, 5, 60_000);
  const r = await sendToUser(user.id, { title: "مهامي ✨", body: "الإشعارات تعمل بنجاح على هذا الجهاز", tag: "test", url: "/" });
  return json(r);
});
