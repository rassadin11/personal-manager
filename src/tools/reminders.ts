import { Type } from "@sinclair/typebox";
import { db } from "../db.js";

type Params = Record<string, unknown>;
type ToolResult = { content: Array<{ type: "text"; text: string }> };
type CronService = {
  list: (opts?: { includeDisabled?: boolean }) => Promise<Array<{ id?: string; name?: string }>>;
  add: (input: Record<string, unknown>) => Promise<{ id?: string } | unknown>;
  remove: (id: string) => Promise<unknown>;
};
type RegisterToolCfg = {
  name: string;
  description: string;
  parameters: unknown;
  execute: (_toolCallId: string, p: Params) => Promise<ToolResult>;
};
type RegisterHookCfg = {
  hookName: string;
  handler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;
};
type PluginApi = {
  registerTool: (cfg: RegisterToolCfg) => void;
  registerHook: (cfg: RegisterHookCfg) => void;
};

// Shared state captured from OpenClaw hooks
let cronService: CronService | null = null;
let lastSessionKey: string | null = null;
let lastChannelId: string | null = null;

function text(msg: string): ToolResult {
  return { content: [{ type: "text", text: msg }] };
}

function formatRemindAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

async function createCronForReminder(
  id: number,
  title: string,
  remindAt: Date,
  sessionKey: string,
  channelId: string,
): Promise<string | null> {
  if (!cronService) return null;
  try {
    const m = remindAt.getMinutes();
    const h = remindAt.getHours();
    const d = remindAt.getDate();
    const mo = remindAt.getMonth() + 1;
    const result = await cronService.add({
      name: `reminder-${id}`,
      description: title,
      enabled: true,
      schedule: { kind: "cron", expr: `${m} ${h} ${d} ${mo} *` },
      sessionTarget: sessionKey,
      wakeMode: "now",
      payload: { kind: "agentTurn", text: `🔔 Напоминание: ${title}` },
      delivery: { mode: "announce", channel: channelId },
    });
    const r = result as Record<string, unknown>;
    return typeof r?.id === "string" ? r.id : null;
  } catch {
    return null;
  }
}

export function registerReminderTools(api: PluginApi): void {
  // Capture cron service when gateway starts
  api.registerHook({
    hookName: "gateway_start",
    handler(_event, ctx) {
      const c = ctx as { getCron?: () => CronService | undefined };
      cronService = c.getCron?.() ?? null;
    },
  });

  // Capture session info on each conversation turn
  api.registerHook({
    hookName: "before_prompt_build",
    handler(event, ctx) {
      const agentCtx = ctx as { sessionKey?: string; channelId?: string };
      if (agentCtx.sessionKey) lastSessionKey = agentCtx.sessionKey;
      if (agentCtx.channelId) lastChannelId = agentCtx.channelId;

      // Inject overdue reminders into context
      const now = new Date().toISOString();
      const due = db
        .prepare("SELECT * FROM reminders WHERE remind_at <= ? ORDER BY remind_at ASC")
        .all(now);
      if (due.length === 0) return;
      const lines = due.map(
        (r) => `• [${r["id"]}] ${r["title"]} (было в ${formatRemindAt(String(r["remind_at"]))})`
      );
      return {
        prependContext: `🔔 Просроченные напоминания:\n${lines.join("\n")}\n\nСообщи пользователю об этих напоминаниях и спроси, что с ними сделать.`,
      };
    },
  });

  api.registerTool({
    name: "pm_reminder_add",
    description:
      "Создать напоминание на конкретную дату и время. Если известен sessionKey текущего пользователя — создаёт cron-задачу в OpenClaw, которая сама напомнит в нужный момент.",
    parameters: Type.Object({
      title: Type.String({ description: "Текст напоминания" }),
      remind_at: Type.String({
        description: "Дата и время в формате ISO 8601, напр. 2026-05-10T14:30:00",
      }),
    }),
    async execute(_id, p) {
      const title = String(p.title ?? "").trim();
      const remindAtStr = String(p.remind_at ?? "").trim();
      if (!title) return text("Ошибка: текст напоминания обязателен.");
      const remindAt = new Date(remindAtStr);
      if (isNaN(remindAt.getTime())) return text(`Ошибка: неверный формат даты «${remindAtStr}».`);

      const result = db
        .prepare("INSERT INTO reminders (title, remind_at, created_at) VALUES (?, ?, ?)")
        .run(title, remindAt.toISOString(), new Date().toISOString());
      const reminderId = result.lastInsertRowid as number;

      let cronNote = "";
      if (lastSessionKey && lastChannelId) {
        const cronId = await createCronForReminder(
          reminderId,
          title,
          remindAt,
          lastSessionKey,
          lastChannelId,
        );
        if (cronId) {
          db.prepare("UPDATE reminders SET cron_id = ? WHERE id = ?").run(cronId, reminderId);
          cronNote = " Cron-задача создана — уведомление придёт автоматически.";
        } else {
          cronNote = " (cron недоступен — напомню при следующем разговоре)";
        }
      } else {
        cronNote = " (sessionKey ещё неизвестен — напомню при следующем разговоре)";
      }

      return text(
        `Напоминание ${reminderId} создано: «${title}» на ${formatRemindAt(remindAt.toISOString())}.${cronNote}`,
      );
    },
  });

  api.registerTool({
    name: "pm_reminder_list",
    description: "Показать список предстоящих напоминаний.",
    parameters: Type.Object({
      include_past: Type.Optional(
        Type.Boolean({ description: "Включить просроченные (по умолчанию false)" })
      ),
    }),
    async execute(_id, p) {
      const now = new Date().toISOString();
      const rows =
        p.include_past === true
          ? db.prepare("SELECT * FROM reminders ORDER BY remind_at ASC").all()
          : db
              .prepare("SELECT * FROM reminders WHERE remind_at > ? ORDER BY remind_at ASC")
              .all(now);
      if (rows.length === 0) return text("Напоминаний нет.");
      const lines = rows.map((r) => {
        const past = String(r["remind_at"]) < now ? " ⚠️ просрочено" : "";
        return `[${r["id"]}] ${r["title"]} — ${formatRemindAt(String(r["remind_at"]))}${past}`;
      });
      return text(lines.join("\n"));
    },
  });

  api.registerTool({
    name: "pm_reminder_delete",
    description: "Удалить напоминание по ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID напоминания" }),
    }),
    async execute(_toolCallId, p) {
      const id = Number(p.id);
      const row = db.prepare("SELECT cron_id FROM reminders WHERE id = ?").get(id) as
        | { cron_id: string | null }
        | undefined;
      if (!row) return text(`Напоминание ${id} не найдено.`);

      if (row.cron_id && cronService) {
        try {
          await cronService.remove(row.cron_id);
        } catch {
          // cron уже удалён или недоступен — не критично
        }
      }
      db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
      return text(`Напоминание ${id} удалено.`);
    },
  });
}
