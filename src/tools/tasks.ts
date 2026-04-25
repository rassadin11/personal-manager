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
type PluginApi = { registerTool: (cfg: RegisterToolCfg) => void };

function text(msg: string): ToolResult {
  return { content: [{ type: "text", text: msg }] };
}

export function registerTaskTools(api: PluginApi): void {
  api.registerTool({
    name: "pm_task_add",
    description: "Создать новую задачу. Укажи название; опционально — описание, приоритет (low/medium/high) и дедлайн (ISO 8601).",
    parameters: Type.Object({
      title: Type.String({ description: "Название задачи" }),
      description: Type.Optional(Type.String({ description: "Описание" })),
      priority: Type.Optional(
        Type.Union(
          [Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")],
          { description: "Приоритет, по умолчанию medium" }
        )
      ),
      due_at: Type.Optional(Type.String({ description: "Дедлайн, напр. 2026-05-01 или 2026-05-01T18:00:00" })),
    }),
    async execute(_id, p) {
      const title = String(p.title ?? "").trim();
      if (!title) return text("Ошибка: название задачи не может быть пустым.");
      const result = db
        .prepare(
          "INSERT INTO tasks (title, description, priority, due_at, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
        )
        .run(
          title,
          p.description != null ? String(p.description) : null,
          p.priority != null ? String(p.priority) : "medium",
          p.due_at != null ? String(p.due_at) : null,
          new Date().toISOString()
        );
      return text(`Задача создана (id ${result.lastInsertRowid}): «${title}»`);
    },
  });

  api.registerTool({
    name: "pm_task_list",
    description: "Показать список задач. Фильтр по статусу: pending (по умолчанию), done, all.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.Union(
          [Type.Literal("pending"), Type.Literal("done"), Type.Literal("all")],
          { description: "Фильтр по статусу" }
        )
      ),
    }),
    async execute(_id, p) {
      const filter = p.status != null ? String(p.status) : "pending";
      const rows =
        filter === "all"
          ? db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all()
          : db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC").all(filter);
      if (rows.length === 0) return text("Задач нет.");
      const lines = rows.map((r) => {
        const done = r["status"] === "done";
        const prio = r["priority"] !== "medium" ? ` [${r["priority"]}]` : "";
        const due = r["due_at"] ? ` → ${r["due_at"]}` : "";
        return `${done ? "✓" : "○"} [${r["id"]}] ${r["title"]}${prio}${due}`;
      });
      return text(lines.join("\n"));
    },
  });

  api.registerTool({
    name: "pm_task_done",
    description: "Отметить задачу как выполненную по её ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID задачи" }),
    }),
    async execute(_id, p) {
      const id = Number(p.id);
      const result = db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(id);
      if ((result.changes as number) === 0) return text(`Задача ${id} не найдена.`);
      return text(`Задача ${id} выполнена.`);
    },
  });

  api.registerTool({
    name: "pm_task_delete",
    description: "Удалить задачу по её ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID задачи" }),
    }),
    async execute(_id, p) {
      const id = Number(p.id);
      const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      if ((result.changes as number) === 0) return text(`Задача ${id} не найдена.`);
      return text(`Задача ${id} удалена.`);
    },
  });
}
