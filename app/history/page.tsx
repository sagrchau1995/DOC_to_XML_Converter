import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";

export default function HistoryPage() {
  return (
    <AppShell>
      <PageHeader title="Job History" description="Search previous declarations, review versions, validation reports, generated files, and audit history." />
      <section className="rounded-md border border-line bg-white p-5 text-sm text-muted">No jobs loaded.</section>
    </AppShell>
  );
}
