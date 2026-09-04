import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  Building2,
  FileSignature,
  Landmark,
  LayoutDashboard,
  Ticket,
  Siren,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { ErpAccessLevel, ErpModuleKey } from "@/types/database";

/**
 * The ERP module registry.
 *
 * Every tab is an autonomous module: its own data layer under
 * `src/modules/<key>/data.ts`, its own writes in `actions.ts`, its own route
 * at `/admin/<key>`, and its own row in the grant matrix. Nothing reaches
 * across into another module's tables, so a module can be reworked, disabled
 * or lifted out without touching the others.
 *
 * This file is the single place that knows the full set. Navigation, the
 * permission matrix and the route guards all read it, which is what keeps a
 * new module from being visible somewhere it is not authorised — the
 * alternative, a hand-maintained nav array, drifts on the first addition.
 *
 * The keys are mirrored by the `erp_module_access_known_module` constraint in
 * the database, so authorisation holds even if a request never touches this
 * code.
 */

export type ModuleKey = ErpModuleKey | "access";

export interface ErpModule {
  key: ModuleKey;
  label: string;
  /** One line, shown under the page title. Says what the module is for. */
  purpose: string;
  href: string;
  icon: LucideIcon;
  /**
   * Owner-only modules never appear in the grant matrix. Administering
   * accounts is one: a holder could grant themselves every other module, so
   * the escalation is removed rather than policed.
   */
  ownerOnly: boolean;
  /**
   * When false, the module is granted and routed but not listed in the
   * sidebar. Contracts and invoices live on the domain they belong to.
   */
  inNav: boolean;
  /** `planned` modules are registered but not yet routable. */
  status: "live" | "planned";
}

export const ERP_MODULES: readonly ErpModule[] = [
  {
    key: "overview",
    label: "Overview",
    purpose:
      "Estate health, recurring revenue and anything waiting on someone today.",
    href: "/admin",
    icon: LayoutDashboard,
    ownerOnly: false,
    inNav: true,
    status: "live",
  },
  {
    key: "domains",
    label: "Domains",
    purpose:
      "Each property by name: its contract, invoices, listening fleet and twin.",
    href: "/admin/domains",
    icon: Building2,
    ownerOnly: false,
    inNav: true,
    status: "live",
  },
  {
    key: "contracts",
    label: "Contracts",
    purpose: "Terms, duration and renewal dates for a property.",
    href: "/admin/domains",
    icon: FileSignature,
    ownerOnly: false,
    inNav: false,
    status: "live",
  },
  {
    key: "invoices",
    label: "Invoices",
    purpose: "Issued invoices against a contract, payments and what is overdue.",
    href: "/admin/domains",
    icon: ReceiptText,
    ownerOnly: false,
    inNav: false,
    status: "live",
  },
  {
    key: "accounting",
    label: "Accounting",
    purpose: "Recurring revenue, cash collected and the shape of the book.",
    href: "/admin/accounting",
    icon: Landmark,
    ownerOnly: false,
    inNav: true,
    status: "live",
  },
  {
    key: "tickets",
    label: "Tickets",
    purpose:
      "Internal work for IT, commerce and marketing: assigned, prioritised, colour-coded.",
    href: "/admin/tickets",
    icon: Ticket,
    ownerOnly: false,
    inNav: true,
    status: "live",
  },
  {
    key: "incidents",
    label: "Incidents",
    purpose: "Issues raised by hotels: close, suspend, or turn into an internal ticket.",
    href: "/admin/incidents",
    icon: Siren,
    ownerOnly: false,
    inNav: true,
    status: "live",
  },
  {
    key: "audio",
    label: "Audio & AI",
    purpose: "Ingestion throughput, model confidence and clip review.",
    href: "/admin/audio",
    icon: AudioLines,
    ownerOnly: false,
    inNav: true,
    status: "live",
  },
  {
    key: "access",
    label: "Access",
    purpose: "ERP accounts and the modules each of them may open.",
    href: "/admin/access",
    icon: ShieldCheck,
    ownerOnly: true,
    inNav: true,
    status: "live",
  },
] as const;

const BY_KEY = new Map(ERP_MODULES.map((module) => [module.key, module]));

export function moduleFor(key: ModuleKey): ErpModule {
  const found = BY_KEY.get(key);
  if (!found) throw new Error(`Unknown ERP module: ${key}`);
  return found;
}

/** Modules that can be granted to platform staff, in nav order. */
export function grantableModules(): ErpModule[] {
  return ERP_MODULES.filter(
    (module) => !module.ownerOnly && module.status === "live"
  );
}

export const ACCESS_LEVEL_LABEL: Record<ErpAccessLevel | "none", string> = {
  none: "No access",
  read: "Read",
  write: "Read & write",
};
