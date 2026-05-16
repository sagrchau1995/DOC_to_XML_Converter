"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Anchor, CheckCircle2, Circle, FileUp, Loader2, Plane, Trash2, Truck, XCircle } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";
import { createJob, startExtraction, uploadDocument } from "@/services/api";
import { useJobStore } from "@/stores/job-store";

const isDev = process.env.NODE_ENV !== "production";

type DashboardCustomsType = "BY_AIR_IMPORT" | "BY_LAND_IMPORT" | "BY_SEA_IMPORT" | "BY_DRYPORT_IMPORT";
type FileStatus = "pending_code" | "ready" | "uploading" | "uploaded" | "failed";
type UploadRow = {
  id: string;
  file: File;
  code: string;
  status: FileStatus;
  documentId?: string;
  error?: string;
};

const acceptedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls", ".csv"];

const documentCodes: Record<string, { label: string; documentType: string; metadata?: Record<string, unknown> }> = {
  "043": { label: "Banking Document", documentType: "BANKING_DOCUMENT" },
  "100": { label: "Invoice", documentType: "INVOICE" },
  "101": { label: "Airway Bill / MAWB + HAWB", documentType: "AIRWAY_BILL", metadata: { contains_mawb_hawb: true, combined_airway_bill: true } },
  "102": { label: "Indian Customs Document", documentType: "INDIAN_CUSTOMS_DOCUMENT" },
  "103": { label: "Packing List", documentType: "PACKING_LIST" },
  "104": { label: "Banking Document", documentType: "BANKING_DOCUMENT" },
  "105": { label: "Country of Origin", documentType: "COUNTRY_OF_ORIGIN" },
  "106": { label: "Insurance Document", documentType: "INSURANCE_DOCUMENT" },
  "107": { label: "Bill of Lading", documentType: "BILL_OF_LADING" },
  "108": { label: "Freight Document", documentType: "FREIGHT_DOCUMENT" },
  "109": { label: "Delivery Order", documentType: "DELIVERY_ORDER" },
  "199": { label: "Other Document", documentType: "OTHER_DOCUMENT" },
  "999": { label: "Supporting Documents", documentType: "SUPPORTING_DOCUMENTS", metadata: { may_contain_multiple_supporting_documents: true } }
};

const codeGuide = [
  ["043", "Banking Document"],
  ["100", "Invoice"],
  ["101", "Airway Bill / MAWB + HAWB"],
  ["102", "Indian Customs Document"],
  ["103", "Packing List"],
  ["104", "Banking Document"],
  ["105", "Country of Origin"],
  ["106", "Insurance Document"],
  ["107", "Bill of Lading"],
  ["108", "Freight Document"],
  ["109", "Delivery Order"],
  ["199", "Other Document"],
  ["999", "Supporting Documents"]
];

const requiredByType: Record<DashboardCustomsType, Array<{ code: string; label: string; recommended?: boolean }>> = {
  BY_AIR_IMPORT: [
    { code: "100", label: "Invoice / code 100" },
    { code: "101", label: "Airway Bill / code 101" },
    { code: "103", label: "Packing List / code 103" },
    { code: "BANK", label: "Banking Document / code 043 or 104 recommended", recommended: true }
  ],
  BY_LAND_IMPORT: [
    { code: "100", label: "Invoice / code 100" },
    { code: "103", label: "Packing List / code 103" },
    { code: "TRANSPORT", label: "Transport/B/L/supporting document / code 999 or 199" },
    { code: "BANK", label: "Banking Document / code 043 or 104 recommended", recommended: true }
  ],
  BY_SEA_IMPORT: [
    { code: "100", label: "Invoice / code 100" },
    { code: "103", label: "Packing List / code 103" },
    { code: "TRANSPORT", label: "B/L or transport document / code 107, 999, or 199" },
    { code: "BANK", label: "Banking Document / code 043 or 104 recommended", recommended: true }
  ],
  BY_DRYPORT_IMPORT: [
    { code: "100", label: "Invoice / code 100" },
    { code: "103", label: "Packing List / code 103" },
    { code: "TRANSPORT", label: "B/L/container/supporting document / code 107, 999, or 199" },
    { code: "BANK", label: "Banking Document / code 043 or 104 recommended", recommended: true }
  ]
};

const steps = ["Setup", "Documents", "Codes", "Upload", "Proceed"];

export default function DashboardPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setStoredJob = useJobStore((state) => state.setJob);
  const [customsType, setCustomsType] = useState<DashboardCustomsType>("BY_AIR_IMPORT");
  const [jobUserPrompt, setJobUserPrompt] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [jobId, setJobId] = useState("");
  const [statusText, setStatusText] = useState("No files uploaded yet");
  const [error, setError] = useState("");
  const [creatingUploading, setCreatingUploading] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const validation = useMemo(() => {
    const codes = rows.map((row) => row.code.trim());
    const hasFiles = rows.length > 0;
    const allCodesValid = hasFiles && rows.every((row) => Boolean(documentCodes[row.code.trim()]));
    const requiredCodes = requiredByType[customsType].filter((item) => !item.recommended).map((item) => item.code);
    const requiredPresent = requiredCodes.every((code) => hasRequirement(code, codes));
    const allUploaded = hasFiles && rows.every((row) => row.status === "uploaded");
    const readyToCreate = Boolean(customsType) && hasFiles && allCodesValid && requiredPresent;
    return { hasFiles, allCodesValid, requiredPresent, allUploaded, readyToCreate };
  }, [customsType, rows]);

  useEffect(() => {
    if (isDev) console.debug("[easy-customs]", "selected customs type", customsType);
  }, [customsType]);

  useEffect(() => {
    if (isDev) console.debug("[easy-customs]", "validation result", validation);
    if (error) {
      setStatusText("Failed with backend error");
      return;
    }
    if (proceeding) {
      setStatusText("Proceeding to extraction");
      return;
    }
    if (creatingUploading) {
      setStatusText("Uploading documents");
      return;
    }
    if (!rows.length) {
      setStatusText("No files uploaded yet");
      return;
    }
    if (!validation.allCodesValid) {
      setStatusText("Waiting for document codes");
      return;
    }
    if (validation.allUploaded) {
      setStatusText("Documents uploaded successfully");
      return;
    }
    if (validation.readyToCreate) {
      setStatusText("Ready to create job");
      return;
    }
    setStatusText("Waiting for required documents");
  }, [creatingUploading, error, proceeding, rows.length, validation]);

  function addFiles(files: FileList | File[]) {
    const next = Array.from(files)
      .filter((file) => {
        const name = file.name.toLowerCase();
        return acceptedExtensions.some((extension) => name.endsWith(extension));
      })
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        code: "",
        status: "pending_code" as FileStatus
      }));
    if (!next.length) {
      setError("Only PDF, JPG, JPEG, PNG, XLSX, XLS, and CSV files are accepted.");
      return;
    }
    setError("");
    setRows((current) => [...current, ...next]);
    if (isDev) console.debug("[easy-customs]", "uploaded files", next.map((row) => ({ name: row.file.name, size: row.file.size })));
  }

  function onBrowse(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  }

  function setCode(id: string, code: string) {
    const normalized = code.replace(/\D/g, "").slice(0, 3);
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const resolved = documentCodes[normalized];
      return { ...row, code: normalized, status: resolved ? "ready" : "pending_code", error: resolved || !normalized ? "" : "Invalid document code." };
    }));
    if (isDev) console.debug("[easy-customs]", "document code mapping", { code: normalized, resolved: documentCodes[normalized] ?? null });
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function clearAll() {
    setRows([]);
    setJobId("");
    setError("");
    setStatusText("No files uploaded yet");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("easy_customs_job_id");
      window.localStorage.removeItem("current_job_id");
    }
  }

  async function createAndUpload() {
    if (!validation.readyToCreate || creatingUploading) return;
    setError("");
    setCreatingUploading(true);
    try {
      let activeJobId = jobId;
      if (!activeJobId) {
        const created = await createJob(customsType, jobUserPrompt);
        activeJobId = created.job_id;
        setJobId(activeJobId);
        setStoredJob(created.job_id, created.customs_type);
        if (typeof window !== "undefined") window.localStorage.setItem("easy_customs_job_id", created.job_id);
        if (typeof window !== "undefined") window.localStorage.setItem("current_job_id", created.job_id);
        if (isDev) console.debug("[easy-customs]", "created job_id", created.job_id);
      }

      for (const row of rows) {
        if (row.status === "uploaded") continue;
        const resolved = documentCodes[row.code.trim()];
        if (!resolved) continue;
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: "uploading", error: "" } : item));
        try {
          const response = await uploadDocument(activeJobId, {
            file: row.file,
            documentCode: row.code.trim(),
            documentType: resolved.documentType,
            originalFilename: row.file.name,
            metadata: resolved.metadata ?? {}
          });
          const documentId = String(response.id ?? "");
          setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: "uploaded", documentId, error: "" } : item));
          if (isDev) console.debug("[easy-customs]", "upload response per file", { filename: row.file.name, response });
        } catch (err) {
          const message = err instanceof Error ? err.message : `Upload failed for ${row.file.name}.`;
          setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: "failed", error: `Upload failed for ${row.file.name}. ${message}` } : item));
          throw new Error(`Upload failed for ${row.file.name}. ${message}`);
        }
      }
      setStatusText("Documents uploaded successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job.");
    } finally {
      setCreatingUploading(false);
    }
  }

  async function proceed() {
    if (!jobId || !validation.allUploaded || proceeding) return;
    setError("");
    setProceeding(true);
    if (isDev) console.debug("[easy-customs]", "proceed clicked", { job_id: jobId });
    try {
      const response = await startExtraction(jobId);
      if (isDev) console.debug("[easy-customs]", "proceed response", response);
      const target = `/progress?job_id=${jobId}`;
      if (isDev) console.debug("[easy-customs]", "navigation target", target);
      setStatusText("Extraction started");
      router.push(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start extraction.");
      setProceeding(false);
    }
  }

  const activeStep = getActiveStep(rows, validation, creatingUploading, proceeding);

  return (
    <AppShell>
      <PageHeader title="EASY CUSTOMS XML GENERATOR" description="Dashboard control center for document upload, job creation, extraction, review, validation, and XML generation." />

      <section className="rounded-md border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          {steps.map((step, index) => (
            <div key={step} className={`flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-black ${index < activeStep ? "border-green-200 bg-green-50 text-success" : index === activeStep ? "border-blue-200 bg-blue-50 text-blue-700" : "border-line bg-canvas text-muted"}`}>
              {index < activeStep ? <CheckCircle2 size={17} /> : <Circle size={17} />}
              {index + 1}. {step}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-line bg-white p-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-xs font-black uppercase text-muted">Section 1 - Job Setup</p>
          <h2 className="mt-2 text-xl font-black">Select Customs Type</h2>
          <p className="mt-2 text-sm text-muted">Select customs mode, upload all documents, assign document codes, then proceed for XML review.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setCustomsType("BY_AIR_IMPORT")} className={`focus-ring min-h-28 rounded-md border p-4 text-left ${customsType === "BY_AIR_IMPORT" ? "border-teal bg-teal text-white" : "border-line bg-canvas text-ink"}`}>
            <Plane size={22} />
            <span className="mt-3 block font-black">BY_AIR_IMPORT</span>
            <span className={`mt-1 block text-sm ${customsType === "BY_AIR_IMPORT" ? "text-white" : "text-muted"}`}>Invoice, airway bill, packing list, banking, and supporting documents.</span>
          </button>
          <button type="button" onClick={() => setCustomsType("BY_LAND_IMPORT")} className={`focus-ring min-h-28 rounded-md border p-4 text-left ${customsType === "BY_LAND_IMPORT" ? "border-navy bg-navy text-white" : "border-line bg-canvas text-ink"}`}>
            <Truck size={22} />
            <span className="mt-3 block font-black">BY_LAND_IMPORT</span>
            <span className={`mt-1 block text-sm ${customsType === "BY_LAND_IMPORT" ? "text-white" : "text-muted"}`}>Invoice, packing list, B/L or supporting document, and banking if available.</span>
          </button>
          <button type="button" onClick={() => setCustomsType("BY_SEA_IMPORT")} className={`focus-ring min-h-28 rounded-md border p-4 text-left ${customsType === "BY_SEA_IMPORT" ? "border-amber bg-amber text-white" : "border-line bg-canvas text-ink"}`}>
            <Anchor size={22} />
            <span className="mt-3 block font-black">BY_SEA_IMPORT</span>
            <span className={`mt-1 block text-sm ${customsType === "BY_SEA_IMPORT" ? "text-white" : "text-muted"}`}>Invoice, packing list, and bill of lading or supporting transport documents.</span>
          </button>
          <button type="button" onClick={() => setCustomsType("BY_DRYPORT_IMPORT")} className={`focus-ring min-h-28 rounded-md border p-4 text-left ${customsType === "BY_DRYPORT_IMPORT" ? "border-amber bg-amber text-white" : "border-line bg-canvas text-ink"}`}>
            <Anchor size={22} />
            <span className="mt-3 block font-black">BY_DRYPORT_IMPORT</span>
            <span className={`mt-1 block text-sm ${customsType === "BY_DRYPORT_IMPORT" ? "text-white" : "text-muted"}`}>Invoice, packing list, B/L, container, dryport, and delivery documents.</span>
          </button>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <p className="text-xs font-black uppercase text-muted">Section 2 - Special Instructions / Prompt for This Job</p>
        <label className="mt-4 grid gap-2 text-sm font-bold text-ink">
          Special Instructions / Prompt for This Job
          <textarea
            className="focus-ring min-h-32 resize-y rounded-md border border-line bg-white px-3 py-3 font-normal text-ink"
            value={jobUserPrompt}
            onChange={(event) => setJobUserPrompt(event.target.value)}
            placeholder="Optional: Tell the system how to handle this shipment, extraction, field selection, or XML generation."
          />
        </label>
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <p className="text-xs font-black uppercase text-muted">Section 3 - Document Code Guide</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {codeGuide.map(([code, label]) => (
            <div key={code} className="rounded-md border border-line bg-canvas p-3">
              <span className="text-lg font-black text-teal">{code}</span>
              <span className="ml-2 text-sm font-bold">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <p className="text-xs font-black uppercase text-muted">Section 4 - Drag and Drop Upload</p>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
          onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`focus-ring mt-4 grid min-h-56 cursor-pointer place-items-center rounded-md border-2 border-dashed p-8 text-center ${dragActive ? "border-teal bg-green-50" : "border-line bg-canvas"}`}
        >
          <div>
            <FileUp className="mx-auto text-teal" size={42} />
            <h2 className="mt-4 text-xl font-black">Drop all customs documents here</h2>
            <p className="mt-2 text-sm text-muted">PDF, JPG, JPEG, PNG, XLSX, XLS, CSV. Click to browse or drag multiple files together.</p>
            <span className="mt-4 inline-flex rounded-md bg-teal px-5 py-3 font-bold text-white">Choose Files</span>
          </div>
        </div>
        <input ref={inputRef} className="hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv" onChange={onBrowse} />
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <p className="text-xs font-black uppercase text-muted">Section 5 - Uploaded Documents Table</p>
        <div className="mt-4 overflow-auto rounded-md border border-line">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="border-b border-line px-3 py-3">Original file name</th>
                <th className="border-b border-line px-3 py-3">File size</th>
                <th className="border-b border-line px-3 py-3">Document code</th>
                <th className="border-b border-line px-3 py-3">Resolved document type</th>
                <th className="border-b border-line px-3 py-3">Upload status</th>
                <th className="border-b border-line px-3 py-3">Extraction status</th>
                <th className="border-b border-line px-3 py-3">Remove</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => {
                const resolved = documentCodes[row.code.trim()];
                return (
                  <tr key={row.id}>
                    <td className="border-b border-line px-3 py-3 font-semibold">{row.file.name}{row.error ? <p className="mt-1 text-xs font-bold text-danger">{row.error}</p> : null}</td>
                    <td className="border-b border-line px-3 py-3">{formatBytes(row.file.size)}</td>
                    <td className="border-b border-line px-3 py-3">
                      <input className="focus-ring min-h-10 w-28 rounded-md border border-line px-3" value={row.code} placeholder="100" disabled={row.status === "uploading" || row.status === "uploaded"} onChange={(event) => setCode(row.id, event.target.value)} />
                    </td>
                    <td className="border-b border-line px-3 py-3">{resolved?.label ?? "Unresolved"}</td>
                    <td className="border-b border-line px-3 py-3"><StatusBadge status={row.status} /></td>
                    <td className="border-b border-line px-3 py-3">{proceeding ? "Extraction starting" : row.status === "uploaded" ? "Ready for extraction" : "Not uploaded"}</td>
                    <td className="border-b border-line px-3 py-3">
                      <button className="focus-ring inline-flex min-h-10 items-center rounded-md border border-line px-3 text-danger disabled:opacity-40" disabled={row.status === "uploading" || proceeding} onClick={() => removeRow(row.id)} aria-label={`Remove ${row.file.name}`}>
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td className="px-3 py-4 text-muted" colSpan={7}>No files uploaded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-line bg-white p-5">
          <p className="text-xs font-black uppercase text-muted">Section 5 - Required Document Checklist</p>
          <div className="mt-4 grid gap-3">
            {requiredByType[customsType].map((item) => {
              const codes = rows.map((row) => row.code.trim());
              const present = hasRequirement(item.code, codes);
              return (
                <div key={item.code} className={`flex min-h-12 items-center gap-3 rounded-md border px-3 ${present ? "border-green-200 bg-green-50 text-success" : item.recommended ? "border-amber-200 bg-amber-50 text-amber" : "border-line bg-canvas text-ink"}`}>
                  {present ? <CheckCircle2 size={18} /> : item.recommended ? <Circle size={18} /> : <XCircle size={18} />}
                  <span className="font-bold">{item.label}</span>
                </div>
              );
            })}
            <p className="text-sm text-muted">Other documents are optional unless your shipment requires additional supporting evidence.</p>
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-5">
          <p className="text-xs font-black uppercase text-muted">Section 7 - Status / Error Panel</p>
          <div className={`mt-4 rounded-md border p-4 ${error ? "border-red-200 bg-red-50 text-danger" : validation.allUploaded ? "border-green-200 bg-green-50 text-success" : "border-line bg-canvas text-ink"}`}>
            <p className="font-black">{statusText}</p>
            <p className="mt-2 text-sm">Job ID: <span className="font-bold">{jobId || "not created yet"}</span></p>
            {error ? <p className="mt-2 text-sm font-bold">{error}</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <p className="text-xs font-black uppercase text-muted">Section 8 - Action Buttons</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="focus-ring rounded-md border border-line px-5 py-3 font-bold" onClick={clearAll} disabled={creatingUploading || proceeding}>Clear All</button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-navy px-5 py-3 font-bold text-white disabled:opacity-50" onClick={createAndUpload} disabled={!validation.readyToCreate || validation.allUploaded || creatingUploading || proceeding}>
            {creatingUploading ? <Loader2 className="animate-spin" size={18} /> : null}
            {creatingUploading ? "Creating and uploading..." : jobId ? "Upload Documents" : "Create Job and Upload Documents"}
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-teal px-5 py-3 font-bold text-white disabled:opacity-50" onClick={proceed} disabled={!jobId || !validation.allUploaded || !validation.allCodesValid || proceeding || creatingUploading}>
            {proceeding ? <Loader2 className="animate-spin" size={18} /> : null}
            {proceeding ? "Starting extraction..." : "Proceed for XML Generation Review"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}

function getActiveStep(rows: UploadRow[], validation: { allCodesValid: boolean; allUploaded: boolean }, uploading: boolean, proceeding: boolean) {
  if (proceeding) return 4;
  if (validation.allUploaded) return 4;
  if (uploading) return 3;
  if (validation.allCodesValid) return 3;
  if (rows.length) return 2;
  return 0;
}

function hasRequirement(code: string, codes: string[]) {
  if (code === "BANK") return codes.includes("043") || codes.includes("104");
  if (code === "TRANSPORT") return codes.includes("107") || codes.includes("108") || codes.includes("109") || codes.includes("999") || codes.includes("199") || codes.includes("101");
  return codes.includes(code);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: FileStatus }) {
  const styles: Record<FileStatus, string> = {
    pending_code: "border-line bg-canvas text-muted",
    ready: "border-blue-200 bg-blue-50 text-blue-700",
    uploading: "border-blue-200 bg-blue-50 text-blue-700",
    uploaded: "border-green-200 bg-green-50 text-success",
    failed: "border-red-200 bg-red-50 text-danger"
  };
  const labels: Record<FileStatus, string> = {
    pending_code: "Pending code",
    ready: "Ready",
    uploading: "Uploading",
    uploaded: "Uploaded",
    failed: "Failed"
  };
  return <span className={`inline-flex min-h-8 items-center rounded-md border px-2 text-xs font-black ${styles[status]}`}>{labels[status]}</span>;
}
