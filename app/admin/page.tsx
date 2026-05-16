import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";

export default function AdminPage() {
  return (
    <AppShell>
      <PageHeader title="Admin Settings" description="Manage approved data files, extractor configuration status, role access, upload policies, and operational health." />
      <section className="grid gap-4 md:grid-cols-3">
        {["HS tariff source", "Bank CSV source", "Payment terms CSV", "Azure extractor", "Google fallback", "LlamaParse", "ChatGPT QA", "Upload policy", "Audit retention"].map((setting) => (
          <div key={setting} className="rounded-md border border-line bg-white p-4">
            <p className="font-black">{setting}</p>
            <p className="mt-2 text-sm text-muted">Configured by environment or admin upload.</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
