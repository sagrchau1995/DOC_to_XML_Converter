"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";
import { generateXml, validateJob } from "@/services/api";
import { useJobId } from "@/hooks/use-job-id";

const isDev = process.env.NODE_ENV !== "production";

type ValidationIssue = {
  severity?: string;
  code?: string;
  field?: string;
  item_number?: number | null;
  extracted_value?: unknown;
  expected_value?: unknown;
  suggested_correction?: unknown;
  message?: string;
};

type ValidationReport = { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };

export default function ValidationPage() {
  const router = useRouter();
  const jobId = useJobId();
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (isDev && jobId) console.debug("[easy-customs]", "current job_id", jobId);

  async function runValidation(): Promise<ValidationReport | null> {
    if (!jobId) return null;
    setError("");
    setLoading(true);
    try {
      const response = await validateJob(jobId);
      if (isDev) console.debug("[easy-customs]", "validation response", response);
      setReport(response as ValidationReport);
      return response as ValidationReport;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function createXml() {
    if (!jobId) return;
    setError("");
    setGenerating(true);
    try {
      const currentReport = await runValidation();
      if (!currentReport?.valid) {
        setError("Validation has blocking errors. Correct the review fields shown below, then generate XML again.");
        return;
      }
      const response = await generateXml(jobId);
      if (isDev) console.debug("[easy-customs]", "XML generation response", response);
      router.push(`/downloads?job_id=${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "XML generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  const hasBlockingErrors = Boolean(report && report.errors.length > 0);

  return (
    <AppShell>
      <PageHeader title="Validation" description="Run deterministic validation against reviewed job-specific data before XML generation." />
      {!jobId ? <ErrorBanner message="No active job found. Please start from Dashboard." /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {hasBlockingErrors ? <ErrorBanner message="Blocking validation errors exist. XML generation is disabled until review is corrected." /> : null}
      {report?.valid ? <SuccessBanner message="Validation passed. XML generation is available for this job." /> : null}

      <div className="flex flex-wrap gap-3">
        <button onClick={() => void runValidation()} disabled={!jobId || loading || generating} className="focus-ring w-fit rounded-md bg-teal px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? "Running..." : "Run Validation"}</button>
        <button onClick={() => jobId && router.push(`/review/items?job_id=${jobId}`)} disabled={!jobId} className="focus-ring w-fit rounded-md border border-line bg-white px-5 py-3 font-bold disabled:opacity-50">Back to Review</button>
        <button onClick={createXml} disabled={!jobId || loading || generating} className="focus-ring w-fit rounded-md bg-navy px-5 py-3 font-bold text-white disabled:opacity-50">{generating ? "Generating..." : "Validate and Generate XML"}</button>
      </div>

      <section className="grid gap-3 rounded-md border border-line bg-white p-5">
        <div className="flex items-center justify-between border-b border-line py-3">
          <span className="font-bold">Job ID: {jobId || "not selected"}</span>
          <span className={`rounded-md px-2 py-1 text-xs font-black ${report?.valid ? "bg-green-50 text-green-700" : report ? "bg-red-50 text-red-700" : "bg-canvas text-muted"}`}>{report ? (report.valid ? "Passed" : "Blocked") : "Not run"}</span>
        </div>
        <IssueSection title="Blocking Errors" tone="red" issues={report?.errors ?? []} />
        <IssueSection title="Warnings" tone="amber" issues={report?.warnings ?? []} />
        {report && !report.errors.length && !report.warnings.length ? <p className="text-sm text-muted">No validation issues to display.</p> : null}
      </section>
    </AppShell>
  );
}

function IssueSection({ title, tone, issues }: { title: string; tone: "red" | "amber"; issues: ValidationIssue[] }) {
  if (!issues.length) return null;
  return (
    <div className={`rounded-md border p-4 ${tone === "red" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <h3 className={`font-black ${tone === "red" ? "text-red-700" : "text-amber-800"}`}>{title}</h3>
      <div className="mt-3">
        <IssuesTable issues={issues} />
      </div>
    </div>
  );
}

function IssuesTable({ issues }: { issues: ValidationIssue[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-canvas">
          <tr>{["Severity", "Rule", "Field", "Item", "Current", "Expected", "Suggested", "Message"].map((header) => <th key={header} className="border-b border-line px-3 py-3">{header}</th>)}</tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={`${issue.code}-${index}`}>
              <td className="border-b border-line px-3 py-3 font-bold">{issue.severity ?? "warning"}</td>
              <td className="border-b border-line px-3 py-3">{issue.code ?? "-"}</td>
              <td className="border-b border-line px-3 py-3">{issue.field ?? "-"}</td>
              <td className="border-b border-line px-3 py-3">{issue.item_number ?? "-"}</td>
              <td className="border-b border-line px-3 py-3">{formatValue(issue.extracted_value)}</td>
              <td className="border-b border-line px-3 py-3">{formatValue(issue.expected_value)}</td>
              <td className="border-b border-line px-3 py-3">{formatValue(issue.suggested_correction)}</td>
              <td className="border-b border-line px-3 py-3">{issue.message ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function ErrorBanner({ message }: { message: string }) {
  return <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>;
}

function SuccessBanner({ message }: { message: string }) {
  return <p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</p>;
}
