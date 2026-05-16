"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";
import { downloadUrl, getGeneratedFiles, type GeneratedFile } from "@/services/api";
import { useJobId } from "@/hooks/use-job-id";

const isDev = process.env.NODE_ENV !== "production";

const artifacts = [
  { key: "xml", fileType: "xml", label: "Final ASYCUDA XML", description: "Job-specific XML generated from reviewed and validated data." },
  { key: "brand-model-size", fileType: "brand_model_size", label: "Brand / Model / Size file", description: "ValTemplate spreadsheet for the same job." },
  { key: "validation-report", fileType: "validation_report", label: "Validation report", description: "JSON report from the last validation run." },
  { key: "extraction-audit", fileType: "extraction_audit", label: "Extraction audit JSON", description: "Extraction events, source documents, and manual overrides." }
] as const;

type ArtifactKey = (typeof artifacts)[number]["key"];

function filenameFromResponse(response: Response, fallback: string) {
  const header = response.headers.get("content-disposition") ?? "";
  const match = header.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

async function responseMessage(response: Response) {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = parsed.detail ?? parsed.message ?? parsed.error;
    return typeof detail === "string" ? detail : JSON.stringify(detail ?? parsed);
  } catch {
    return text;
  }
}

export default function DownloadsPage() {
  const jobId = useJobId();
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState<ArtifactKey | null>(null);

  const { data: generatedFiles = [], error, isLoading, refetch } = useQuery({
    queryKey: ["generated-files", jobId],
    queryFn: () => getGeneratedFiles(jobId ?? ""),
    enabled: Boolean(jobId)
  });

  const fileByType = useMemo(() => {
    const byType = new Map<string, GeneratedFile>();
    generatedFiles.forEach((file) => {
      if (!byType.has(file.file_type)) byType.set(file.file_type, file);
    });
    return byType;
  }, [generatedFiles]);

  async function downloadArtifact(artifact: ArtifactKey) {
    if (!jobId) {
      setMessage("No active job found. Please start from Dashboard.");
      return;
    }
    setMessage("");
    setDownloading(artifact);
    try {
      const target = downloadUrl(jobId, artifact);
      if (isDev) console.debug("[easy-customs-download]", { job_id: jobId, url: target });
      const token = window.localStorage.getItem("easy_customs_token") ?? "";
      const response = await fetch(target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error(await responseMessage(response));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromResponse(response, `${jobId}-${artifact}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage("Download started.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  if (!jobId) {
    return (
      <AppShell>
        <PageHeader title="Download Center" description="Download artifacts for a generated job." />
        <div className="rounded-md border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          No active job found. Please start from Dashboard.
        </div>
      </AppShell>
    );
  }

  const hasXml = fileByType.has("xml");

  return (
    <AppShell>
      <PageHeader title="Download Center" description="Download generated artifacts for this job only. No demo links are shown." />

      <section className="rounded-md border border-line bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Current Job</p>
        <p className="mt-1 break-all font-mono text-sm font-bold text-ink">{jobId}</p>
      </section>

      {isLoading ? (
        <div className="rounded-md border border-line bg-white p-5 text-sm font-semibold text-slate-600">Loading generated files...</div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {error instanceof Error ? error.message : "Failed to load generated files."}
        </div>
      ) : null}

      {!isLoading && !error && !hasXml ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
          No XML generated yet. Please run validation and generate XML first.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {artifacts.map((artifact) => {
          const file = fileByType.get(artifact.fileType);
          const disabled = !file || downloading === artifact.key;
          return (
            <div key={artifact.key} className="rounded-md border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-black text-ink">{artifact.label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{artifact.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${file ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {file ? "Available" : "Not generated"}
                </span>
              </div>
              {file ? <p className="mt-3 break-all text-xs text-slate-500">SHA256: {file.sha256}</p> : null}
              <button
                className="focus-ring mt-4 rounded-md border border-line px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={() => downloadArtifact(artifact.key)}
              >
                {downloading === artifact.key ? "Downloading..." : "Download"}
              </button>
            </div>
          );
        })}
      </section>

      <div className="flex gap-3">
        <button className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-bold" onClick={() => refetch()} disabled={isLoading}>
          Refresh Files
        </button>
        <a className="focus-ring rounded-md bg-navy px-4 py-2 text-sm font-bold text-white" href={`/validation?job_id=${encodeURIComponent(jobId)}`}>
          Back to Validation
        </a>
      </div>

      {message ? <p className="rounded-md border border-line bg-white p-4 text-sm font-semibold">{message}</p> : null}
    </AppShell>
  );
}
