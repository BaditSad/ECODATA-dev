"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ERP_MODULES, type ModuleKey } from "@/modules/registry";
import { useMessages } from "@/i18n/LocaleProvider";

/**
 * Sidebar navigation.
 *
 * Takes module *keys* rather than modules: the manifests carry Lucide
 * components, which cannot cross the server/client boundary, so the client
 * resolves them from the registry itself. The server still decides what is
 * listed — this component cannot widen it.
 */
export function ModuleNav({ allowed }: { allowed: ModuleKey[] }) {
  const pathname = usePathname();
  const t = useMessages();
  const visible = ERP_MODULES.filter((module) => allowed.includes(module.key));

  return (
    <nav className="flex flex-row gap-0.5 md:flex-col" aria-label={t.erp.navAria}>
      {visible.map((module) => {
        // Overview owns the bare `/admin` root, so only it matches exactly;
        // every other module also owns its nested pages.
        const active =
          module.href === "/admin"
            ? pathname === "/admin"
            : pathname === module.href || pathname.startsWith(`${module.href}/`);

        const Icon = module.icon;

        return (
          <Link
            key={module.key}
            href={module.href}
            aria-current={active ? "page" : undefined}
            className="flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 font-sans text-[12px] transition-colors"
            style={
              active
                ? {
                    background: "var(--edl-emerald-10)",
                    color: "var(--edl-emerald)",
                  }
                : { color: "var(--edl-muted)" }
            }
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden />
            {t.modules[module.key].label}
          </Link>
        );
      })}
    </nav>
  );
}
