export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("./server/scheduler");
    startReminderScheduler();
  }
}
