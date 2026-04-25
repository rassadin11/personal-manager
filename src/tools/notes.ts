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

export function registerNoteTools(api: PluginApi): void {
  api.registerTool({
    name: "pm_note_add",
    description: "Создать новую заметку с заголовком и текстом.",
    parameters: Type.Object({
      title: Type.String({ description: "Заголовок заметки" }),
      body: Type.Optional(Type.String({ description: "Текст заметки" })),
    }),
    async execute(_id, p) {
      const title = String(p.title ?? "").trim();
      if (!title) return text("Ошибка: заголовок заметки обязателен.");
      const body = p.body != null ? String(p.body) : "";
      const now = new Date().toISOString();
      const result = db
        .prepare("INSERT INTO notes (title, body, updated_at, created_at) VALUES (?, ?, ?, ?)")
        .run(title, body, now, now);
      return text(`Заметка ${result.lastInsertRowid} создана: «${title}»`);
    },
  });

  api.registerTool({
    name: "pm_note_list",
    description: "Показать список заметок (только заголовки и ID).",
    parameters: Type.Object({}),
    async execute(_id, _p) {
      const rows = db.prepare("SELECT id, title, updated_at FROM notes ORDER BY updated_at DESC").all();
      if (rows.length === 0) return text("Заметок нет.");
      const lines = rows.map((r) => {
        const date = String(r["updated_at"]).slice(0, 10);
        return `[${r["id"]}] ${r["title"]} (${date})`;
      });
      return text(lines.join("\n"));
    },
  });

  api.registerTool({
    name: "pm_note_get",
    description: "Прочитать заметку по ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID заметки" }),
    }),
    async execute(_id, p) {
      const id = Number(p.id);
      const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
      if (!row) return text(`Заметка ${id} не найдена.`);
      const date = String(row["updated_at"]).slice(0, 10);
      const body = String(row["body"]);
      return text(`# ${row["title"]} (${date})\n\n${body || "(пусто)"}`);
    },
  });

  api.registerTool({
    name: "pm_note_update",
    description: "Обновить заголовок или текст заметки по ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID заметки" }),
      title: Type.Optional(Type.String({ description: "Новый заголовок" })),
      body: Type.Optional(Type.String({ description: "Новый текст (заменяет старый)" })),
    }),
    async execute(_id, p) {
      const id = Number(p.id);
      const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
      if (!row) return text(`Заметка ${id} не найдена.`);

      const title = p.title != null ? String(p.title).trim() : String(row["title"]);
      const body = p.body != null ? String(p.body) : String(row["body"]);
      if (!title) return text("Ошибка: заголовок не может быть пустым.");

      db.prepare("UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?").run(
        title,
        body,
        new Date().toISOString(),
        id
      );
      return text(`Заметка ${id} обновлена.`);
    },
  });

  api.registerTool({
    name: "pm_note_delete",
    description: "Удалить заметку по ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID заметки" }),
    }),
    async execute(_id, p) {
      const id = Number(p.id);
      const result = db.prepare("DELETE FROM notes WHERE id = ?").run(id);
      if ((result.changes as number) === 0) return text(`Заметка ${id} не найдена.`);
      return text(`Заметка ${id} удалена.`);
    },
  });
}
