"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";
import { getExtractedData, updateItems, type InvoiceItem } from "@/services/api";
import { useJobId } from "@/hooks/use-job-id";

const isDev = process.env.NODE_ENV !== "production";
const columns = ["Item", "Original Item Name", "Commercial Description", "Brand", "Model", "Size", "Qty", "Invoice Unit", "Unit Price", "Total", "Invoice HS", "OpenAI Suggested HS", "Nepal DB 11-digit HS", "HS Description", "Supp. Unit", "Supp. Qty", "COO", "Packages", "Gross KG", "Net KG", "Review", "Actions"];

export default function ItemsReviewPage() {
  const router = useRouter();
  const jobId = useJobId();
  const { data, error, refetch, isLoading } = useQuery({ queryKey: ["extracted-items", jobId], queryFn: () => getExtractedData(jobId), enabled: Boolean(jobId) });
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDev && jobId) console.debug("[easy-customs]", "current job_id", jobId);
  }, [jobId]);

  useEffect(() => {
    if (data?.declaration) {
      const ordered = coerceItems(data.declaration).sort((a, b) => a.line_number - b.line_number);
      setItems(ordered);
      if (isDev) console.debug("[easy-customs]", "loaded extracted data", { job_id: jobId, items: ordered });
    }
  }, [data, jobId]);

  function patch(index: number, key: keyof InvoiceItem, value: string | number | boolean | null) {
    setSaved(false);
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const updated = { ...item, [key]: value } as InvoiceItem;
      if (key === "description" || key === "quantity" || key === "unit") {
        updated.commercial_description = formatCommercialDescription(updated.description, updated.quantity, updated.unit);
      }
      return updated;
    }));
  }

  async function save() {
    if (!jobId || !items.length) return;
    setMessage("");
    setSaving(true);
    try {
      const response = await updateItems(jobId, items);
      if (isDev) console.debug("[easy-customs]", "save items response", response);
      await refetch();
      setSaved(true);
      setMessage("Reviewed item rows saved in invoice order.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save reviewed items.");
    } finally {
      setSaving(false);
    }
  }

  function continueToValidation() {
    if (!jobId) return;
    router.push(`/validation?job_id=${jobId}`);
  }

  function addItem() {
    setSaved(false);
    setItems((current) => [
      ...current,
      {
        line_number: current.length + 1,
        description: "",
        commercial_description: "",
        quantity: 0,
        unit: "PCS",
        unit_price: 0,
        total_price: 0,
        invoice_hs_code: "",
        ai_suggested_hs_code: "",
        nepal_hs_code: "",
        tariff_description: "",
        supplementary_unit: "",
        supplementary_quantity: null,
        origin_country_code: "",
        package_count: 0.01,
        gross_weight: 0,
        net_weight: 0,
        package_kind: "CT",
        review_required: true,
        review_notes: ["Manual item row added during review."]
      }
    ]);
  }

  function removeItem(index: number) {
    setSaved(false);
    setMessage("Item row removed. Save Items and HS to persist this change.");
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, line_number: itemIndex + 1 })));
  }

  const localIssues = validateItems(items);

  return (
    <AppShell>
      <PageHeader title="Items and HS Review" description="Review invoice-ordered item rows extracted for this job before validation." />
      {!jobId ? <ErrorBanner message="No active job found. Please start from Dashboard." /> : null}
      {data && !data.declaration ? <Notice message="No extracted declaration found for this job. Please run extraction first." /> : null}
      {error ? <ErrorBanner message={error instanceof Error ? error.message : "Unable to load extracted items."} /> : null}
      {isLoading ? <Notice message="Loading invoice item rows and HS suggestions..." /> : null}
      {data?.declaration ? (
        <section className="grid gap-3 rounded-md border border-line bg-white p-5 text-ink sm:grid-cols-4">
          <Metric label="Invoice items" value={String(items.length)} />
          <Metric label="Invoice total" value={String(data.declaration.invoice.invoice_total ?? 0)} />
          <Metric label="Package total" value={String(data.declaration.packing?.total_packages ?? "")} />
          <Metric label="HS needing review" value={String(items.filter((item) => item.review_required || !item.nepal_hs_code).length)} />
        </section>
      ) : null}
      {localIssues.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          <p className="font-black">Item review checks need attention before validation:</p>
          <ul className="mt-2 grid gap-1">
            {localIssues.slice(0, 8).map((issue) => <li key={issue}>- {issue}</li>)}
            {localIssues.length > 8 ? <li>- {localIssues.length - 8} more issue(s)</li> : null}
          </ul>
        </div>
      ) : null}

      <section className="overflow-auto rounded-md border border-line bg-white text-ink">
        <table className="w-full min-w-[2300px] text-left text-sm text-ink">
          <thead className="bg-canvas text-ink">
            <tr>{columns.map((column) => <th key={column} className="border-b border-line px-3 py-3">{column}</th>)}</tr>
          </thead>
          <tbody>
            {items.length ? items.map((item, index) => (
              <tr key={`${item.line_number}-${item.description}`}>
                <td className="border-b border-line px-3 py-3 font-bold">{item.line_number}</td>
                <td className="border-b border-line px-3 py-3"><Input value={item.description} onChange={(value) => patch(index, "description", value)} wide /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.commercial_description || formatCommercialDescription(item.description, item.quantity, item.unit)} onChange={(value) => patch(index, "commercial_description", value)} wide /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.brand ?? ""} onChange={(value) => patch(index, "brand", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.model ?? ""} onChange={(value) => patch(index, "model", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.size ?? ""} onChange={(value) => patch(index, "size", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={String(item.quantity)} onChange={(value) => patch(index, "quantity", Number(value || 0))} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.unit} onChange={(value) => patch(index, "unit", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={String(item.unit_price ?? "")} onChange={(value) => patch(index, "unit_price", Number(value || 0))} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={String(item.total_price ?? "")} onChange={(value) => patch(index, "total_price", Number(value || 0))} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.invoice_hs_code ?? ""} onChange={(value) => patch(index, "invoice_hs_code", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.ai_suggested_hs_code ?? ""} onChange={(value) => patch(index, "ai_suggested_hs_code", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.nepal_hs_code ?? ""} onChange={(value) => patch(index, "nepal_hs_code", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.tariff_description ?? ""} onChange={(value) => patch(index, "tariff_description", value)} wide /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.supplementary_unit ?? ""} onChange={(value) => patch(index, "supplementary_unit", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={String(item.supplementary_quantity ?? 0)} onChange={(value) => patch(index, "supplementary_quantity", value === "" ? null : Number(value || 0))} decimal /></td>
                <td className="border-b border-line px-3 py-3"><Input value={item.origin_country_code ?? ""} onChange={(value) => patch(index, "origin_country_code", value)} /></td>
                <td className="border-b border-line px-3 py-3"><Input value={String(item.package_count ?? "")} onChange={(value) => patch(index, "package_count", Number(value || 0))} decimal /></td>
                <td className="border-b border-line px-3 py-3"><Input value={String(item.gross_weight ?? "")} onChange={(value) => patch(index, "gross_weight", Number(value || 0))} decimal /></td>
                <td className="border-b border-line px-3 py-3"><Input value={String(item.net_weight ?? "")} onChange={(value) => patch(index, "net_weight", Number(value || 0))} decimal /></td>
                <td className="border-b border-line px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${item.review_required ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>
                    {item.review_required ? "Review" : "OK"}
                  </span>
                  <label className="mt-2 flex items-center gap-2 text-xs font-bold text-ink">
                    <input type="checkbox" checked={Boolean(item.hs_manually_approved)} onChange={(event) => patch(index, "hs_manually_approved", event.target.checked)} />
                    HS approved
                  </label>
                  {item.hs_match_type || item.hs_confidence !== undefined ? <p className="mt-2 text-xs text-muted">{item.hs_match_type || "hs"} {item.hs_confidence !== undefined ? `${Math.round(item.hs_confidence * 100)}%` : ""}</p> : null}
                  {item.hs_reason ? <p className="mt-2 max-w-56 text-xs text-muted">{item.hs_reason}</p> : null}
                  {item.hs_suggestions?.length ? <p className="mt-2 max-w-56 text-xs text-muted">Suggestions: {item.hs_suggestions.slice(0, 3).map(formatSuggestion).join("; ")}</p> : null}
                  {item.review_notes?.length ? <p className="mt-2 max-w-56 text-xs text-amber-800">{item.review_notes.join(" ")}</p> : null}
                </td>
                <td className="border-b border-line px-3 py-3">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={saving || isLoading}
                    className="focus-ring rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-danger disabled:opacity-50"
                    aria-label={`Remove item row ${item.line_number}`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={columns.length}>
                  {data?.declaration ? "No invoice item rows were extracted for this job. Check the invoice document code 100 and rerun extraction, or add rows after backend extraction repair." : "No extracted declaration found for this job. Please run extraction first."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex flex-wrap gap-3">
        <button onClick={addItem} disabled={saving || isLoading} className="focus-ring w-fit rounded-md border border-line bg-white px-5 py-3 font-bold disabled:opacity-50">Add Item Row</button>
        <button onClick={save} disabled={!items.length || saving || isLoading} className="focus-ring w-fit rounded-md bg-teal px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Items and HS"}</button>
        <button onClick={continueToValidation} disabled={!saved} className="focus-ring w-fit rounded-md bg-navy px-5 py-3 font-bold text-white disabled:opacity-50">Continue to Validation</button>
      </div>
      {message ? <p className="rounded-md border border-line bg-white p-4 text-sm font-semibold">{message}</p> : null}
    </AppShell>
  );
}

function Input({ value, onChange, wide = false, decimal = false }: { value: string; onChange: (value: string) => void; wide?: boolean; decimal?: boolean }) {
  return <input inputMode={decimal ? "decimal" : undefined} className={`focus-ring min-h-10 rounded-md border border-line bg-white px-2 text-ink ${wide ? "min-w-72" : "w-28"}`} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <p className="text-xs font-black uppercase text-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value || "-"}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>;
}

function Notice({ message }: { message: string }) {
  return <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{message}</p>;
}

function validateItems(items: InvoiceItem[]) {
  const issues: string[] = [];
  const total = items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  items.forEach((item, index) => {
    const label = `Item ${item.line_number || index + 1}`;
    if (item.line_number !== index + 1) issues.push(`${label}: item order must follow invoice sequence.`);
    if (!/^\d{11}$/.test(item.nepal_hs_code || "")) issues.push(`${label}: Nepal HS must be 11 digits from tariff data.`);
    if (!item.origin_country_code) issues.push(`${label}: COO is required.`);
    if (!item.gross_weight || item.gross_weight <= 0) issues.push(`${label}: gross weight is required.`);
    if (item.net_weight === null || item.net_weight === undefined || item.net_weight < 0) issues.push(`${label}: net weight is required.`);
    if (!item.package_count || item.package_count < 0.01) issues.push(`${label}: package count must be at least 0.01.`);
    if ((item.supplementary_unit || item.primary_unit || "").toUpperCase() === "KG" && item.supplementary_quantity !== item.net_weight) {
      issues.push(`${label}: KG supplementary quantity must equal net weight.`);
    }
  });
  if (items.length && total <= 0) issues.push("Item total prices are missing or zero.");
  return issues;
}

function coerceItems(declaration: any) {
  const rows = declaration.invoice?.items ?? declaration.items ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.map((row: Record<string, unknown>, index: number) => {
    const quantity = toNumber(row.quantity ?? row.qty);
    const total = toNumber(row.total_price ?? row.total ?? row.amount ?? row.value);
    const unitPrice = toNumber(row.unit_price ?? row.price ?? row.rate) || (quantity && total ? total / quantity : 0);
    const suggestions = Array.isArray(row.hs_suggestions) ? row.hs_suggestions as Array<Record<string, unknown>> : [];
    return {
      line_number: toNumber(row.line_number ?? row.item_no) || index + 1,
      description: text(row.description, row.original_item_name, row.item_description, row.commercial_description),
      commercial_description: formatCommercialDescription(text(row.description, row.original_item_name, row.item_description, row.commercial_description), quantity, text(row.unit, row.invoice_unit, row.uom) || "PCS"),
      brand: text(row.brand),
      model: text(row.model),
      size: text(row.size),
      quantity,
      unit: text(row.unit, row.invoice_unit, row.uom) || "PCS",
      unit_price: unitPrice,
      total_price: total || quantity * unitPrice,
      invoice_hs_code: text(row.invoice_hs_code, row.hs_code),
      ai_suggested_hs_code: text(row.ai_suggested_hs_code, row.openai_suggested_hs_code, suggestions[0]?.hs8, suggestions[0]?.hs6),
      nepal_hs_code: text(row.nepal_hs_code, row.final_hs_code),
      tariff_description: text(row.tariff_description, row.hs_description),
      primary_unit: text(row.primary_unit),
      supplementary_unit: text(row.supplementary_unit),
      supplementary_unit_name: text(row.supplementary_unit_name),
      supplementary_quantity: nullableNumber(row.supplementary_quantity),
      origin_country_code: text(row.origin_country_code, row.country_of_origin),
      package_count: nullableNumber(row.package_count),
      gross_weight: nullableNumber(row.gross_weight),
      net_weight: nullableNumber(row.net_weight),
      package_kind: text(row.package_kind) || "CT",
      hs_match_type: text(row.hs_match_type),
      hs_confidence: nullableNumber(row.hs_confidence) ?? 0,
      hs_reason: text(row.hs_reason),
      hs_suggestions: suggestions,
      hs_manually_approved: Boolean(row.hs_manually_approved),
      review_required: Boolean(row.review_required),
      review_notes: Array.isArray(row.review_notes) ? row.review_notes as string[] : []
    } satisfies InvoiceItem;
  });
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isNaN(number) ? 0 : number;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function formatCommercialDescription(description: string, quantity: number, unit: string) {
  const qty = Number.isInteger(Number(quantity)) ? String(Number(quantity)) : String(quantity || "");
  return `${description || ""} - ${qty}${unit ? ` ${unit}` : ""}`.trim();
}

function formatSuggestion(suggestion: Record<string, unknown>) {
  return text(suggestion.hs8, suggestion.hs6, suggestion.nepal_hs_code, suggestion.code, suggestion.description);
}
