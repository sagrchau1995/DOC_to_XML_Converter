import Link from "next/link";
import { Archive, ClipboardCheck, Download, History, LayoutDashboard, Settings, ShieldCheck, Table2 } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress", label: "Progress", icon: Archive },
  { href: "/review/general", label: "General Review", icon: ClipboardCheck },
  { href: "/review/items", label: "Items and HS", icon: Table2 },
  { href: "/validation", label: "Validation", icon: ShieldCheck },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/history", label: "Job History", icon: History },
  { href: "/admin", label: "Admin", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-line bg-white lg:block">
        <div className="border-b border-line p-6">
          <p className="text-xs font-bold uppercase text-muted">Nepal Customs ASYCUDA World</p>
          <h1 className="mt-2 text-xl font-black leading-tight">EASY CUSTOMS XML GENERATOR</h1>
        </div>
        <nav className="p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="focus-ring flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-ink hover:bg-canvas">
                <Icon size={18} className="text-teal" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
