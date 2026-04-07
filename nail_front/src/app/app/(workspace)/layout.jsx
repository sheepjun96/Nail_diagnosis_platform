"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Folder,
  ImageIcon,
  LayoutDashboard,
  Settings,
  Stethoscope,
  UserRound,
} from "lucide-react";

const projectItems = [
  { href: "/app", label: "Main Project", icon: LayoutDashboard },
];

const settingItems = [
  { href: "/app/login", label: "회원 관리", icon: UserRound },
];

function SidebarSection({ title, items, icon: SectionIcon, pathname, defaultOpen = false }) {
  const hasActiveItem = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveItem);

  useEffect(() => {
    if (hasActiveItem) {
      setIsOpen(true);
    }
  }, [hasActiveItem]);

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-white"
      >
        <span className="flex items-center gap-2">
          <SectionIcon className="size-3.5" />
          <span>{title}</span>
        </span>
        <ChevronDown
          className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`overflow-hidden px-3 transition-all duration-200 ${
          isOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 pt-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/18 text-white"
                    : "text-white/80 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function WorkspaceLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-sidebar lg:flex lg:flex-col">
        <Link
          href="/app"
          className="flex min-h-28 items-center justify-center border-b border-white/10 px-6 text-center"
        >
          <div>

            <Image src="/img/ic-logo.svg" alt="logo image" width={240} height={69} />
          </div>
        </Link>

        <div className="flex-1 space-y-6 py-6">
          <SidebarSection
            title="프로젝트"
            items={projectItems}
            icon={Folder}
            pathname={pathname}
            defaultOpen
          />
          <SidebarSection
            title="설정"
            items={settingItems}
            icon={Settings}
            pathname={pathname}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="border-b border-white/10 bg-[#303030] px-4 py-3 shadow-sm lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-white/90">
             
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                  임상의
                </span>
                <span>Douglas McGee</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
