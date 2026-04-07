import Link from "next/link";
import { cn } from "@/lib/utils";

export function WorkspacePage({ children, className }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>{children}</div>;
}

export function WorkspacePageHeader({ title, breadcrumb, action }) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      <h1 className="workspace-page-title">{title}</h1>
      <div className="flex flex-wrap items-center gap-3">
        {breadcrumb ? <div className="text-sm text-white/50">{breadcrumb}</div> : null}
        {action}
      </div>
    </div>
  );
}

export function WorkspacePanel({ title, action, children, className, contentClassName }) {
  return (
    <section
      className={cn(
        "workspace-panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-4",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="workspace-section-title">{title}</h2>
        {action}
      </div>
      <div className={cn("min-h-0 flex-1", contentClassName)}>{children}</div>
    </section>
  );
}

export function WorkspacePlaceholder({ className }) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 rounded-sm border border-dashed border-white/10 bg-[#2a2a2a]",
        className
      )}
    />
  );
}

export function WorkspaceActionLink({ href, children, variant = "secondary" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-sm px-3 text-xs font-semibold whitespace-nowrap text-white transition-colors",
        variant === "danger"
          ? "bg-destructive hover:bg-destructive/90"
          : "bg-[#6c757d] hover:bg-[#5e666d]"
      )}
    >
      {children}
    </Link>
  );
}
