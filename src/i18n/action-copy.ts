import "server-only";

import { messages } from "@/i18n/server";
import { fill } from "@/i18n/console";
import type { NoticesCopy } from "@/i18n/notices";
import type { ActionResult } from "@/lib/actions";
import type { ModuleKey } from "@/modules/registry";

/** Refusal for a caller who lacks the module grant the action requires. */
export function denied(module: ModuleKey): ActionResult<never> {
  const t = messages();
  return {
    ok: false,
    message: fill(t.notices.writeDenied, { module: t.modules[module].label }),
  };
}

export function notice(
  key: keyof NoticesCopy,
  vars?: Record<string, string | number>
): string {
  const text = messages().notices[key];
  return vars ? fill(text, vars) : text;
}
