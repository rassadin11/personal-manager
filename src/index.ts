import { definePluginEntry } from "openclaw/plugin-sdk/core";
import { registerTaskTools } from "./tools/tasks.js";
import { registerReminderTools } from "./tools/reminders.js";
import { registerFinanceTools } from "./tools/finances.js";
import { registerNoteTools } from "./tools/notes.js";

export default definePluginEntry({
  id: "personal-manager",
  name: "Personal Manager",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(api: any) {
    registerTaskTools(api as Parameters<typeof registerTaskTools>[0]);
    registerReminderTools(api as Parameters<typeof registerReminderTools>[0]);
    registerFinanceTools(api as Parameters<typeof registerFinanceTools>[0]);
    registerNoteTools(api as Parameters<typeof registerNoteTools>[0]);
  },
});
