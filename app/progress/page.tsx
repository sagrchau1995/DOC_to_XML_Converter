"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";
import { cancelExtraction, getJobStatus, saveProgressOverrides, startExtraction } from "@/services/api";
import { useJobId } from "@/hooks/use-job-id";

const isDev = process.env.NODE_ENV !== "production";

const overrideFields = [
  ["invoice_number", "Invoice Number"],
  ["invoice_date", "Invoice Date"],
  ["total_packages", "Total Packages"],
  ["gross_weight", "Gross Weight"],
  ["net_weight", "Net Weight"],
  ["mawb_number", "MAWB Number"],
  ["hawb_number", "HAWB Number"],
  ["bl_number", "B/L Number"],
  ["lc_number", "LC Number"],
  ["tt_number", "TT Number"],
  ["swift_reference", "SWIFT Reference"],
  ["bank_reference", "Bank Reference"],
  ["bank_code", "Bank Code"],
  ["payment_term_code", "Payment Term Code"],
  ["freight_amount", "Freight Amount"],
  ["insurance_amount", "Insurance Amount"],
  ["destination_country", "Destination Country"],
  ["country_of_origin", "Country of Origin"],
  ["mode_at_border", "Mode at Border"],
  ["inland_mode", "Inland Mode"],
  ["place_of_destination", "Place of Destination"],
  ["previous_document", "Previous Document / Summary Declaration Override"]
] as const;

export default function ProgressPage() {
  const router = useRouter();
  const jobId = useJobId();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ["status", jobId], queryFn: () => getJobStatus(jobId), enabled: Boolean(jobId), refetchInterval: 2000 });
  const progress = data?.progress_percent ?? 0;
  const failed = data?.status === "EXTRACTION_FAILED";
  const cancelled = data?.status === "CANCELLED" || data?.status === "CANCEL_REQUESTED";
  const ready = data?.status === "READY_FOR_REVIEW" || data?.status === "REVIEW_REQUIRED";

  if (isDev && jobId) console.debug("[easy-customs]", "current job_id", jobId);

  const saveMutation = useMutation({
    mutationFn: () => saveProgressOverrides(jobId, overrides),
    onSuccess: (response) => {
      if (isDev) console.debug("[easy-customs]", "progress override response", response);
      setMessage("Override values saved. General Review will compare them with extracted values.");
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Could not save overrides.")
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelExtraction(jobId),
    onSuccess: async (response) => {
      if (isDev) console.debug("[easy-customs]", "cancel extraction response", response);
      setConfirmCancel(false);
      setMessage("Extraction cancelled.");
      await refetch();
    },
    onError: (err) => {
      setConfirmCancel(false);
      setMessage(err instanceof Error ? err.message : "Could not cancel extraction.");
    }
  });

  async function restartExtraction() {
    if (!jobId) return;
    setMessage("Restarting extraction...");
    try {
      const response = await startExtraction(jobId);
      if (isDev) console.debug("[easy-customs]", "restart extraction response", response);
      await refetch();
      setMessage("Extraction restarted.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not restart extraction.");
    }
  }

  function goGeneral() {
    if (!jobId) return;
    const target = `/review/general?job_id=${jobId}`;
    if (isDev) console.debug("[easy-customs]", "navigation target", target);
    router.push(target);
  }

  return (
    <AppShell>
      <PageHeader title="Extraction Progress" description="Track extraction and add manual overrides before review." />
      {!jobId ? <ErrorBanner message="No active job found. Please start from Dashboard." /> : null}
      {error ? <ErrorBanner message={error instanceof Error ? error.message : "Unable to load job status."} /> : null}

      <section className="rounded-md border border-line bg-white p-5 text-ink">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black">Job ID: {jobId || "not selected"}</p>
          <span className="rounded-md bg-canvas px-3 py-1 text-xs font-black">{isLoading ? "Loading" : data?.status ?? "Waiting"}</span>
        </div>
        <p className="text-lg font-black">Extraction progress: {progress}%</p>
        <div className="mt-3 h-4 overflow-hidden rounded bg-canvas">
          <div className="h-full bg-teal transition-all" style={{ width: `${progress}%` }} />
        </div>
        {data?.latest_error ? <ErrorBanner message={data.latest_error} /> : null}
      </section>

      <section className="rounded-md border border-line bg-white p-5 text-ink">
        <div className="mb-4">
          <h2 className="text-lg font-black">Manual Override During Extraction</h2>
          <p className="mt-1 text-sm text-muted">Values entered here are compared against the system extraction in General Review.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {overrideFields.map(([field, label]) => (
            <label key={field} className="grid gap-2 text-sm font-bold">
              {label}
              <input
                className="focus-ring min-h-11 rounded-md border border-line bg-white px-3 font-normal"
                value={overrides[field] ?? ""}
                onChange={(event) => setOverrides((current) => ({ ...current, [field]: event.target.value }))}
              />
            </label>
          ))}
        </div>
        <button
          className="focus-ring mt-4 rounded-md bg-navy px-5 py-3 font-bold text-white disabled:opacity-50"
          disabled={!jobId || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving..." : "Save Overrides"}
        </button>
      </section>

      <div className="flex flex-wrap gap-3">
        {ready ? <button className="focus-ring rounded-md bg-teal px-5 py-3 font-bold text-white" onClick={goGeneral}>Go to General Review</button> : null}
        {failed || cancelled ? <button className="focus-ring rounded-md bg-white px-5 py-3 font-bold text-danger" onClick={() => router.push("/dashboard")}>Back to Dashboard</button> : null}
        {cancelled ? <button className="focus-ring rounded-md bg-navy px-5 py-3 font-bold text-white" onClick={restartExtraction}>Restart Extraction</button> : null}
        {!ready && !failed && !cancelled ? (
          <button className="focus-ring rounded-md border border-red-200 bg-red-50 px-5 py-3 font-bold text-danger" disabled={!jobId} onClick={() => setConfirmCancel(true)}>Cancel Extraction</button>
        ) : null}
      </div>

      {message ? <p className="rounded-md border border-line bg-white p-4 text-sm font-semibold">{message}</p> : null}

      {confirmCancel ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="max-w-md rounded-md bg-white p-6 text-ink shadow-xl">
            <h2 className="text-lg font-black">Confirm extraction cancellation</h2>
            <p className="mt-3 text-sm text-muted">Are you sure you want to cancel this extraction? This will stop document processing for this job. Uploaded documents will remain saved.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button className="focus-ring rounded-md border border-line px-4 py-2 font-bold" onClick={() => setConfirmCancel(false)}>No, continue extraction</button>
              <button className="focus-ring rounded-md bg-danger px-4 py-2 font-bold text-white" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                {cancelMutation.isPending ? "Cancelling..." : "Yes, cancel extraction"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>;
}
