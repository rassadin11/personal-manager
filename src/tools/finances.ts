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

function fmt(amount: number): string {
  return amount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function registerFinanceTools(api: PluginApi): void {
  api.registerTool({
    name: "pm_finance_add",
    description:
      "Записать доход или расход. Тип: income (доход) или expense (расход). Дата по умолчанию — сегодня.",
    parameters: Type.Object({
      type: Type.Union([Type.Literal("income"), Type.Literal("expense")], {
        description: "income — доход, expense — расход",
      }),
      amount: Type.Number({ description: "Сумма (положительное число)", exclusiveMinimum: 0 }),
      category: Type.Optional(Type.String({ description: "Категория, напр. еда, зарплата, транспорт" })),
      comment: Type.Optional(Type.String({ description: "Комментарий" })),
      date: Type.Optional(Type.String({ description: "Дата YYYY-MM-DD, по умолчанию сегодня" })),
    }),
    async execute(_id, p) {
      const type = String(p.type ?? "");
      if (type !== "income" && type !== "expense")
        return text("Ошибка: type должен быть income или expense.");
      const amount = Number(p.amount);
      if (!isFinite(amount) || amount <= 0) return text("Ошибка: сумма должна быть больше нуля.");
      const date = p.date != null ? String(p.date) : new Date().toISOString().slice(0, 10);
      const result = db
        .prepare(
          "INSERT INTO finances (type, amount, category, comment, date, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(
          type,
          amount,
          p.category != null ? String(p.category) : null,
          p.comment != null ? String(p.comment) : null,
          date,
          new Date().toISOString()
        );
      const sign = type === "income" ? "+" : "−";
      const cat = p.category ? ` [${p.category}]` : "";
      return text(`Запись ${result.lastInsertRowid}: ${sign}${fmt(amount)}${cat} (${date})`);
    },
  });

  api.registerTool({
    name: "pm_finance_list",
    description: "Список транзакций за период. По умолчанию — текущий месяц.",
    parameters: Type.Object({
      from: Type.Optional(Type.String({ description: "Начало периода YYYY-MM-DD" })),
      to: Type.Optional(Type.String({ description: "Конец периода YYYY-MM-DD" })),
      type: Type.Optional(
        Type.Union([Type.Literal("income"), Type.Literal("expense")], {
          description: "Фильтр по типу",
        })
      ),
    }),
    async execute(_id, p) {
      const now = new Date();
      const from =
        p.from != null
          ? String(p.from)
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const to =
        p.to != null ? String(p.to) : now.toISOString().slice(0, 10);

      let rows;
      if (p.type != null) {
        rows = db
          .prepare(
            "SELECT * FROM finances WHERE date >= ? AND date <= ? AND type = ? ORDER BY date DESC, id DESC"
          )
          .all(from, to, String(p.type));
      } else {
        rows = db
          .prepare(
            "SELECT * FROM finances WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC"
          )
          .all(from, to);
      }

      if (rows.length === 0) return text(`Транзакций за ${from} — ${to} нет.`);
      const lines = rows.map((r) => {
        const sign = r["type"] === "income" ? "+" : "−";
        const cat = r["category"] ? ` [${r["category"]}]` : "";
        const note = r["comment"] ? ` ${r["comment"]}` : "";
        return `[${r["id"]}] ${r["date"]} ${sign}${fmt(Number(r["amount"]))}${cat}${note}`;
      });
      return text(lines.join("\n"));
    },
  });

  api.registerTool({
    name: "pm_finance_summary",
    description: "Сводка за период: доходы, расходы, баланс. По умолчанию — текущий месяц.",
    parameters: Type.Object({
      from: Type.Optional(Type.String({ description: "Начало периода YYYY-MM-DD" })),
      to: Type.Optional(Type.String({ description: "Конец периода YYYY-MM-DD" })),
    }),
    async execute(_id, p) {
      const now = new Date();
      const from =
        p.from != null
          ? String(p.from)
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const to = p.to != null ? String(p.to) : now.toISOString().slice(0, 10);

      const rows = db
        .prepare("SELECT type, amount FROM finances WHERE date >= ? AND date <= ?")
        .all(from, to);

      let income = 0;
      let expense = 0;
      for (const r of rows) {
        if (r["type"] === "income") income += Number(r["amount"]);
        else expense += Number(r["amount"]);
      }
      const balance = income - expense;
      const sign = balance >= 0 ? "+" : "−";

      return text(
        `Период: ${from} — ${to}\n` +
          `Доходы:  +${fmt(income)}\n` +
          `Расходы: −${fmt(expense)}\n` +
          `Баланс:  ${sign}${fmt(Math.abs(balance))}`
      );
    },
  });

  api.registerTool({
    name: "pm_finance_delete",
    description: "Удалить запись о доходе/расходе по ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID записи" }),
    }),
    async execute(_id, p) {
      const id = Number(p.id);
      const result = db.prepare("DELETE FROM finances WHERE id = ?").run(id);
      if ((result.changes as number) === 0) return text(`Запись ${id} не найдена.`);
      return text(`Запись ${id} удалена.`);
    },
  });
}
