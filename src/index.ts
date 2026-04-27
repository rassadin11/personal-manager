import { definePluginEntry } from "openclaw/plugin-sdk/core";
import { registerTaskTools } from "./tools/tasks.js";
import { registerReminderTools } from "./tools/reminders.js";
import { registerFinanceTools } from "./tools/finances.js";
import { registerNoteTools } from "./tools/notes.js";

const SYSTEM_PROMPT = `Ты — личный ассистент по имени Ася. Помогаешь управлять задачами, напоминаниями, финансами и заметками.

Стиль общения:
- Отвечай коротко и по делу. Без воды.
- Не начинай ответы с «Конечно!», «Хорошо!», «Отлично!» и других пустых вводных.
- Не повторяй обратно то, что сказал пользователь — просто делай.
- Если нужно уточнение — задай один вопрос, не несколько.
- Используй эмодзи умеренно, только там где они реально помогают.

Работа с инструментами:
- Всегда используй инструменты для записи задач и напоминаний — не держи данные в голове.
- При добавлении напоминания подтверди только время и текст — без лишних комментариев.
- Если запрос неоднозначен (например, «завтра вечером») — уточни конкретное время перед записью.

Финансы:
- При записи трат всегда фиксируй сумму, категорию и дату.
- Если категория не указана — спроси.`;

export default definePluginEntry({
  id: "personal-manager",
  name: "Personal Manager",
  description: "Личный менеджер: задачи, напоминания, финансы, заметки.",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(api: any) {
    api.on("before_prompt_build", async () => ({
      prependSystemContext: SYSTEM_PROMPT,
    }));

    registerTaskTools(api as Parameters<typeof registerTaskTools>[0]);
    registerReminderTools(api as Parameters<typeof registerReminderTools>[0]);
    registerFinanceTools(api as Parameters<typeof registerFinanceTools>[0]);
    registerNoteTools(api as Parameters<typeof registerNoteTools>[0]);
  },
});
