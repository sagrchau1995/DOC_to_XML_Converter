"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";
import { getExtractedData, updateBanking, updateTransport } from "@/services/api";
import { useJobId } from "@/hooks/use-job-id";

export default function BankingReviewPage() {
  const jobId = useJobId();
  const { data, error, refetch } = useQuery({ queryKey: ["extracted-banking", jobId], queryFn: () => getExtractedData(jobId), enabled: Boolean(jobId) });
  const [bankingJson, setBankingJson] = useState("{}");
  const [transportJson, setTransportJson] = useState("{}");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data?.declaration) {
      setBankingJson(JSON.stringify(data.declaration.banking, null, 2));
      setTransportJson(JSON.stringify(data.declaration.transport, null, 2));
    }
  }, [data]);

  async function save() {
    if (!jobId) return;
    setMessage("");
    try {
      await updateBanking(jobId, JSON.parse(bankingJson));
      await updateTransport(jobId, JSON.parse(transportJson));
      await refetch();
      setMessage("Reviewed banking and transport data saved for this job.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save banking or transport data.");
    }
  }

  return (
    <AppShell>
      <PageHeader title="Review Banking, Payment, and Transport Data" description="Edit the extracted JSON for this job only. Invalid JSON or invalid schema is rejected by the backend." />
      <section className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          Banking Data
          <textarea className="focus-ring min-h-96 rounded-md border border-line p-3 font-mono text-xs font-normal" value={bankingJson} onChange={(event) => setBankingJson(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Transport Data
          <textarea className="focus-ring min-h-96 rounded-md border border-line p-3 font-mono text-xs font-normal" value={transportJson} onChange={(event) => setTransportJson(event.target.value)} />
        </label>
      </section>
      <button onClick={save} disabled={!data?.declaration} className="focus-ring w-fit rounded-md bg-teal px-5 py-3 font-bold text-white">Save Reviewed Banking and Transport</button>
      {data && !data.declaration ? <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">No extracted declaration found for this job. Please run extraction first.</p> : null}
      {message ? <p className="rounded-md border border-line bg-white p-4 text-sm font-semibold">{message}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error instanceof Error ? error.message : "Unable to load extracted data."}</p> : null}
    </AppShell>
  );
}
