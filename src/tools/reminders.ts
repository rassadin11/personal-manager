import { Type } from "@sinclair/typebox";
import { db } from "../db.js";

type Params = Record<string, unknown>;
type ToolResult = { content: Array<{ type: "text"; text: string }> };
type RegisterToolCfg = {
  name: string;
  description: string;
  parameters: unknown;
  execute: (_toolCallId: string, p: Params) => Promise<ToolResult>;
};
type PluginApi = {
  registerTool: (cfg: RegisterToolCfg) => void;
  on: (event: string, handler: (...args: unknown[]) => unknown) => void;
};

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

export function registerReminderTools(api: PluginApi): void {
  // Inject current time and overdue reminders into the prompt
  api.on("before_prompt_build", async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowLocal = now.toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: process.env.TZ ?? "Europe/Moscow",
    });

    const due = db
      .prepare("SELECT * FROM reminders WHERE remind_at <= ? ORDER BY remind_at ASC")
      .all(nowIso);

    const overdueBlock =
      due.length > 0
        ? `\n\n🔔 Просроченные напоминания:\n${due
            .map((r) => `• [${r["id"]}] ${r["title"]} (было в ${formatRemindAt(String(r["remind_at"]))})`)
            .join("\n")}\n\nСообщи пользователю об этих напоминаниях и спроси, что с ними сделать.`
        : "";

    return {
      prependSystemContext: `🕐 Текущее время: ${nowLocal} (${nowIso})${overdueBlock}`,
    };
  });

  api.registerTool({
    name: "pm_reminder_add",
    description:
      "Создать напоминание на конкретную дату и время. Сохраняет в БД; в момент следующего разговора с ботом просроченные напоминания будут показаны.",
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

      return text(
        `Напоминание ${reminderId} создано: «${title}» на ${formatRemindAt(remindAt.toISOString())}.`,
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
      const row = db.prepare("SELECT id FROM reminders WHERE id = ?").get(id);
      if (!row) return text(`Напоминание ${id} не найдено.`);

      db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
      return text(`Напоминание ${id} удалено.`);
    },
  });
}
