"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppShell } from "@/layouts/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  getBanks,
  getExtractedData,
  getPaymentTerms,
  getReviewComparison,
  updateGeneralReview,
  type BankReference,
  type CustomsDeclaration,
  type PaymentTermReference,
  type ReviewComparisonRow
} from "@/services/api";
import { useJobId } from "@/hooks/use-job-id";

const isDev = process.env.NODE_ENV !== "production";
type InvoiceDraft = CustomsDeclaration["invoice"];

export default function GeneralReviewPage() {
  const router = useRouter();
  const jobId = useJobId();
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ["extracted-data", jobId], queryFn: () => getExtractedData(jobId), enabled: Boolean(jobId) });
  const { data: comparison } = useQuery({ queryKey: ["review-comparison", jobId], queryFn: () => getReviewComparison(jobId), enabled: Boolean(jobId && data?.declaration) });
  const { data: banks = [] } = useQuery({ queryKey: ["reference-banks"], queryFn: getBanks });
  const { data: paymentTerms = [] } = useQuery({ queryKey: ["reference-payment-terms"], queryFn: getPaymentTerms });
  const [invoice, setInvoice] = useState<InvoiceDraft | null>(null);
  const [packing, setPacking] = useState<Record<string, unknown>>({});
  const [transport, setTransport] = useState<Record<string, unknown>>({});
  const [banking, setBanking] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDev && jobId) console.debug("[easy-customs]", "current job_id", jobId);
  }, [jobId]);

  useEffect(() => {
    if (data?.declaration) {
      const review = buildGeneralReviewState(data.declaration, data.general ?? {});
      setInvoice(review.invoice);
      setPacking(review.packing);
      setTransport(review.transport);
      setBanking(review.banking);
    }
  }, [data]);

  const field40Preview = useMemo(() => resolveField40Preview(transport), [transport]);

  useEffect(() => {
    if (!transport.field_40_selection_mode || transport.field_40_selection_mode === "auto") {
      setTransport((current) => ({ ...current, field_40_selected_document_number: field40Preview.value, field_40_auto_suggestion: field40Preview.auto, field_40_reason: field40Preview.reason }));
    }
  }, [field40Preview.auto, field40Preview.reason, field40Preview.value, transport.field_40_selection_mode]);

  async function save() {
    if (!jobId || !invoice) return;
    setMessage("");
    setSaving(true);
    try {
      const finalTransport = { ...transport, field_40_selected_document_number: field40Preview.value, previous_document: field40Preview.value, field_40_auto_suggestion: field40Preview.auto, field_40_reason: field40Preview.reason };
      const payload = applyProgressOverridesToPayload({ invoice, packing, transport: finalTransport, banking }, comparison?.rows ?? []);
      const response = await updateGeneralReview(jobId, payload);
      if (isDev) console.debug("[easy-customs]", "save general review response", response);
      await refetch();
      setSaved(true);
      setMessage("Reviewed general declaration data saved for this job.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save reviewed data.");
    } finally {
      setSaving(false);
    }
  }

  function continueToItems() {
    if (!jobId) return;
    router.push(`/review/items?job_id=${jobId}`);
  }

  function patchInvoice<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setInvoice((current) => current ? { ...current, [key]: value } : current);
  }

  function selectBank(code: string) {
    const bank = banks.find((item) => item.bank_code === code);
    setBanking({
      ...banking,
      selected_bank_code: bank?.bank_code ?? "",
      selected_bank_name: bank?.bank_name ?? "",
      bank_code: bank?.bank_code ?? "",
      bank_name: bank?.bank_name ?? "",
      bank_swift_code: bank?.swift_code ?? "",
      swift_hint: bank?.swift_code ?? "",
      bank_selection_source: "user_selected"
    });
  }

  function selectPaymentTerm(code: string) {
    const term = paymentTerms.find((item) => item.payment_code === code);
    setBanking({
      ...banking,
      selected_payment_term_code: term?.payment_code ?? "",
      selected_payment_term_description: term?.payment_description ?? "",
      payment_term_code: term?.payment_code ?? "",
      payment_term_name: term?.payment_description ?? "",
      payment_term_selection_source: "user_selected"
    });
  }

  return (
    <AppShell>
      <PageHeader title="General Review" description="Review and select the exact values that will be used for XML generation." />
      {!jobId ? <ErrorBanner message="No active job found. Please start from Dashboard." /> : null}
      {data && !data.declaration ? <Notice message="No extracted declaration found for this job. Please run extraction first." /> : null}
      {error ? <ErrorBanner message={error instanceof Error ? error.message : "Unable to load extracted data."} /> : null}
      {isLoading ? <Notice message="Loading extracted declaration fields..." /> : null}

      <ReviewCard title="Job Instruction">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Special Instructions / Prompt for This Job
          <textarea className="min-h-24 rounded-md border border-line bg-canvas px-3 py-3 font-normal text-muted" readOnly value={String(data?.general?.user_prompt ?? data?.declaration?.user_prompt ?? "")} />
        </label>
      </ReviewCard>

      <ReviewCard title="Invoice / Proforma Invoice Number and Date">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Invoice Number" value={invoice?.invoice_number ?? ""} onChange={(value) => patchInvoice("invoice_number", value)} />
          <Field label="Invoice Date" value={invoice?.invoice_date ?? ""} onChange={(value) => patchInvoice("invoice_date", value)} />
          <Field label="Proforma Invoice Number" value={invoice?.proforma_invoice_number ?? ""} onChange={(value) => patchInvoice("proforma_invoice_number", value)} />
          <Field label="Proforma Invoice Date" value={invoice?.proforma_invoice_date ?? ""} onChange={(value) => patchInvoice("proforma_invoice_date", value)} />
          <SelectField label="Use for XML invoice reference:" value={invoice?.invoice_reference_source ?? "invoice_number"} onChange={(value) => patchInvoice("invoice_reference_source", value)} options={[["invoice_number", "Invoice Number"], ["proforma_invoice_number", "Proforma Invoice Number"], ["manual", "Manual Entry"]]} />
          {invoice?.invoice_reference_source === "manual" ? (
            <>
              <Field label="Final XML Invoice Number" value={invoice?.final_xml_invoice_number ?? ""} onChange={(value) => patchInvoice("final_xml_invoice_number", value)} />
              <Field label="Final XML Invoice Date" value={invoice?.final_xml_invoice_date ?? ""} onChange={(value) => patchInvoice("final_xml_invoice_date", value)} />
            </>
          ) : null}
        </div>
      </ReviewCard>

      <ReviewCard title="Package and Weight">
        <div className="grid gap-4 md:grid-cols-3">
          <RecordField label="Total Package" field="total_packages" record={packing} setRecord={setPacking} numeric />
          <RecordField label="Gross Weight" field="gross_weight" record={packing} setRecord={setPacking} numeric />
          <RecordField label="Net Weight" field="net_weight" record={packing} setRecord={setPacking} numeric />
        </div>
      </ReviewCard>

      <ReviewCard title="Air Waybill">
        <div className="grid gap-4 md:grid-cols-2">
          <RecordField label="Master Air Waybill Number" field="mawb_number" record={transport} setRecord={setTransport} />
          <RecordField label="Master AWB Gross Weight" field="mawb_gross_weight" record={transport} setRecord={setTransport} numeric />
          <RecordField label="House Air Waybill Number" field="hawb_number" record={transport} setRecord={setTransport} />
          <RecordField label="House AWB Gross Weight" field="hawb_gross_weight" record={transport} setRecord={setTransport} numeric />
        </div>
      </ReviewCard>

      <ReviewCard title="Field No. 40 - Select Previous Document">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Field No. 40 Selection Mode" value={String(transport.field_40_selection_mode ?? "auto")} onChange={(value) => setTransport({ ...transport, field_40_selection_mode: value })} options={[["auto", "Auto by weight rule"], ["mawb", "Use Master AWB"], ["hawb", "Use House AWB"], ["manual", "Manual Entry"]]} />
          <Field label="Field 40 Selected Document Number" value={field40Preview.value} onChange={(value) => setTransport({ ...transport, field_40_selected_document_number: value, previous_document: value })} readOnly={String(transport.field_40_selection_mode ?? "auto") !== "manual"} />
          <Field label="Field 40 Auto Suggestion" value={field40Preview.auto} onChange={() => undefined} readOnly />
          <Field label="Field 40 Reason" value={field40Preview.reason} onChange={() => undefined} readOnly />
        </div>
      </ReviewCard>

      <ReviewCard title="Banking Information">
        <div className="grid gap-4 md:grid-cols-2">
          <ReferenceSelect label="Bank and Bank Code" value={String(banking.selected_bank_code ?? banking.bank_code ?? "")} onChange={selectBank} options={banks.map(bankOption)} />
          <ReferenceSelect label="Terms of Payment and Code" value={String(banking.selected_payment_term_code ?? banking.payment_term_code ?? "")} onChange={selectPaymentTerm} options={paymentTerms.map(paymentOption)} />
          <RecordField label="LC Number" field="lc_number" record={banking} setRecord={setBanking} />
          <RecordField label="TT Number" field="tt_number" record={banking} setRecord={setBanking} />
          <RecordField label="SWIFT Reference" field="swift_reference" record={banking} setRecord={setBanking} />
          <RecordField label="Final LC/TT/SWIFT Reference" field="lc_or_tt_reference" record={banking} setRecord={setBanking} />
        </div>
      </ReviewCard>

      <ReviewCard title="Freight and Insurance">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Freight Amount" value={String(invoice?.freight_amount ?? "")} onChange={(value) => patchInvoice("freight_amount", value === "" ? null : Number(value || 0))} />
          <Field label="Freight Currency" value={invoice?.freight_currency ?? invoice?.currency ?? ""} onChange={(value) => patchInvoice("freight_currency", value.toUpperCase())} />
          <Field label="Insurance Amount" value={String(invoice?.insurance_amount ?? "")} onChange={(value) => patchInvoice("insurance_amount", value === "" ? null : Number(value || 0))} />
          <Field label="Insurance Currency" value={invoice?.insurance_currency ?? invoice?.currency ?? ""} onChange={(value) => patchInvoice("insurance_currency", value.toUpperCase())} />
        </div>
      </ReviewCard>

      <ReviewCard title="Validation Preview">
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-canvas">
              <tr>{["Field", "System Extracted Value", "User Override Value", "Match Status", "Final Value Used"].map((header) => <th key={header} className="border-b border-line px-3 py-3">{header}</th>)}</tr>
            </thead>
            <tbody>
              {(comparison?.rows ?? []).map((row) => (
                <tr key={row.field}>
                  <td className="border-b border-line px-3 py-3 font-bold">{labelize(row.field)}</td>
                  <td className="border-b border-line px-3 py-3">{displayValue(row.system_value)}</td>
                  <td className="border-b border-line px-3 py-3">{displayValue(row.override_value)}</td>
                  <td className="border-b border-line px-3 py-3"><StatusBadge status={row.status} /></td>
                  <td className="border-b border-line px-3 py-3 font-semibold">{displayValue(row.final_value)}</td>
                </tr>
              ))}
              {!comparison?.rows?.length ? <tr><td className="px-3 py-4 text-muted" colSpan={5}>No progress overrides were entered for this job.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </ReviewCard>

      <div className="flex flex-wrap gap-3">
        <button onClick={save} disabled={!invoice || saving || isLoading} className="focus-ring w-fit rounded-md bg-teal px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save General Review"}</button>
        <button onClick={continueToItems} disabled={!saved} className="focus-ring w-fit rounded-md bg-navy px-5 py-3 font-bold text-white disabled:opacity-50">Continue to Items and HS</button>
      </div>
      {message ? <p className="rounded-md border border-line bg-white p-4 text-sm font-semibold">{message}</p> : null}
    </AppShell>
  );
}

function ReviewCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-md border border-line bg-white p-5 text-ink"><h2 className="mb-4 text-lg font-black">{title}</h2>{children}</section>;
}

function Field({ label, value, onChange, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  return <label className="grid gap-2 text-sm font-bold text-ink">{label}<input className="focus-ring min-h-11 rounded-md border border-line bg-white px-3 font-normal text-ink read-only:bg-canvas read-only:text-muted" value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="grid gap-2 text-sm font-bold text-ink">{label}<select className="focus-ring min-h-11 rounded-md border border-line bg-white px-3 font-normal text-ink" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}

function ReferenceSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="grid gap-2 text-sm font-bold text-ink">{label}<select className="focus-ring min-h-11 rounded-md border border-line bg-white px-3 font-normal text-ink" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select...</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function RecordField({ label, field, record, setRecord, numeric = false }: { label: string; field: string; record: Record<string, unknown>; setRecord: (value: Record<string, unknown>) => void; numeric?: boolean }) {
  return <Field label={label} value={String(record[field] ?? "")} onChange={(value) => setRecord({ ...record, [field]: numeric ? nullableNumber(value) ?? 0 : value })} />;
}

function buildGeneralReviewState(declaration: CustomsDeclaration, general: Record<string, unknown>) {
  const raw = { ...(declaration as CustomsDeclaration & Record<string, unknown>), ...general };
  const invoice = {
    ...declaration.invoice,
    importer: {
      ...(declaration.invoice.importer ?? {}),
      name: text(declaration.invoice.importer?.name, raw.importer_name, raw.consignee_name),
      address: text(declaration.invoice.importer?.address, raw.importer_address, raw.consignee_address),
      tax_id: text(declaration.invoice.importer?.tax_id, raw.importer_pan_vat, raw.importer_pan, raw.pan, raw.vat),
      exim_code: text(declaration.invoice.importer?.exim_code, raw.importer_exim_code, raw.exim_code)
    },
    exporter: {
      ...(declaration.invoice.exporter ?? {}),
      name: text(declaration.invoice.exporter?.name, raw.exporter_name, raw.supplier_name, raw.shipper_name),
      address: text(declaration.invoice.exporter?.address, raw.exporter_address, raw.supplier_address),
      country_code: text(declaration.invoice.exporter?.country_code, raw.export_country)
    },
    invoice_number: cleanInvoiceNumber(text(declaration.invoice.invoice_number, raw.invoice_number)),
    invoice_date: text(declaration.invoice.invoice_date, raw.invoice_date),
    proforma_invoice_number: text(declaration.invoice.proforma_invoice_number, raw.proforma_invoice_number),
    proforma_invoice_date: text(declaration.invoice.proforma_invoice_date, raw.proforma_invoice_date),
    final_xml_invoice_number: text(declaration.invoice.final_xml_invoice_number, raw.final_xml_invoice_number),
    final_xml_invoice_date: text(declaration.invoice.final_xml_invoice_date, raw.final_xml_invoice_date),
    invoice_reference_source: text(declaration.invoice.invoice_reference_source, raw.invoice_reference_source) || "invoice_number",
    currency: text(declaration.invoice.currency, raw.invoice_currency, raw.currency),
    invoice_total: numberValue(declaration.invoice.invoice_total, raw.invoice_total),
    incoterm: text(declaration.invoice.incoterm, raw.incoterm),
    normalized_incoterm: text(declaration.invoice.normalized_incoterm, declaration.invoice.incoterm, raw.normalized_incoterm),
    payment_terms_text: text(declaration.invoice.payment_terms_text, raw.payment_term_hint, raw.payment_terms_text),
    country_of_origin: text(declaration.invoice.country_of_origin, declaration.origin?.country_of_origin, raw.country_of_origin),
    destination: text(declaration.invoice.destination, declaration.transport?.destination, raw.destination),
    freight_amount: nullableNumber(declaration.invoice.freight_amount, raw.freight_amount),
    freight_currency: text(declaration.invoice.freight_currency, raw.freight_currency, declaration.invoice.currency),
    insurance_amount: nullableNumber(declaration.invoice.insurance_amount, raw.insurance_amount),
    insurance_currency: text(declaration.invoice.insurance_currency, raw.insurance_currency, declaration.invoice.currency),
    exchange_rate: nullableNumber(declaration.invoice.exchange_rate, declaration.banking?.exchange_rate, raw.exchange_rate)
  } satisfies InvoiceDraft;
  const packing = {
    ...(declaration.packing ?? {}),
    total_packages: numberValue(declaration.packing?.total_packages, declaration.transport?.number_of_packages, raw.total_packages),
    gross_weight: numberValue(declaration.packing?.gross_weight, declaration.transport?.hawb_gross_weight, declaration.transport?.mawb_gross_weight, declaration.transport?.bill_of_lading_gross_weight, raw.gross_weight),
    net_weight: numberValue(declaration.packing?.net_weight, raw.net_weight)
  };
  const transport = {
    ...(declaration.transport ?? {}),
    mawb_number: text(declaration.transport?.mawb_number, raw.mawb_number, raw.mawb),
    mawb_gross_weight: nullableNumber(declaration.transport?.mawb_gross_weight, raw.mawb_gross_weight),
    hawb_number: text(declaration.transport?.hawb_number, raw.hawb_number, raw.hawb),
    hawb_gross_weight: nullableNumber(declaration.transport?.hawb_gross_weight, raw.hawb_gross_weight),
    field_40_selection_mode: text(declaration.transport?.field_40_selection_mode, raw.field_40_selection_mode) || "auto",
    field_40_selected_document_number: text(declaration.transport?.field_40_selected_document_number, raw.field_40_selected_document_number, declaration.transport?.previous_document),
    field_40_auto_suggestion: text(declaration.transport?.field_40_auto_suggestion, raw.field_40_auto_suggestion),
    field_40_reason: text(declaration.transport?.field_40_reason, raw.field_40_reason),
    previous_document: text(declaration.transport?.previous_document, raw.field_40_selected_document_number)
  };
  const banking = {
    ...(declaration.banking ?? {}),
    payment_hint: text(declaration.banking?.payment_hint, declaration.banking?.payment_term_hint, invoice.payment_terms_text),
    payment_term_hint: text(declaration.banking?.payment_term_hint, declaration.banking?.payment_hint, invoice.payment_terms_text),
    selected_payment_term_code: text(declaration.banking?.selected_payment_term_code, declaration.banking?.payment_term_code, raw.selected_payment_term_code, raw.payment_term_code),
    selected_payment_term_description: text(declaration.banking?.selected_payment_term_description, declaration.banking?.payment_term_name, raw.selected_payment_term_description),
    payment_term_code: text(declaration.banking?.payment_term_code, raw.payment_term_code),
    payment_term_name: text(declaration.banking?.payment_term_name, raw.selected_payment_term_description),
    lc_number: text(declaration.banking?.lc_number, raw.lc_number),
    tt_number: text(declaration.banking?.tt_number, raw.tt_number),
    swift_reference: text(declaration.banking?.swift_reference, declaration.banking?.swift_hint, raw.swift_reference),
    lc_or_tt_reference: text(declaration.banking?.lc_or_tt_reference, raw.lc_or_tt_reference),
    selected_bank_code: text(declaration.banking?.selected_bank_code, declaration.banking?.bank_code, raw.selected_bank_code, raw.resolved_bank_code),
    selected_bank_name: text(declaration.banking?.selected_bank_name, declaration.banking?.bank_name, raw.selected_bank_name, raw.resolved_bank_name),
    bank_code: text(declaration.banking?.bank_code, raw.resolved_bank_code),
    bank_name: text(declaration.banking?.bank_name, raw.resolved_bank_name),
    bank_swift_code: text(declaration.banking?.bank_swift_code, raw.bank_swift_code, declaration.banking?.swift_hint)
  };
  return { invoice, packing, transport, banking };
}

function resolveField40Preview(transport: Record<string, unknown>) {
  const mawb = text(transport.mawb_number);
  const hawb = text(transport.hawb_number);
  const mawbWeight = nullableNumber(transport.mawb_gross_weight);
  const hawbWeight = nullableNumber(transport.hawb_gross_weight);
  const weightsSame = mawbWeight !== null && hawbWeight !== null && Math.abs(mawbWeight - hawbWeight) <= 0.01;
  const auto = weightsSame && mawb ? mawb : hawb;
  const autoReason = weightsSame ? "MAWB and HAWB weights are same, so MAWB selected." : "MAWB and HAWB weights are different, so HAWB selected.";
  const mode = text(transport.field_40_selection_mode) || "auto";
  if (mode === "mawb") return { value: mawb, auto, reason: "User selected Master AWB for Field 40." };
  if (mode === "hawb") return { value: hawb, auto, reason: "User selected House AWB for Field 40." };
  if (mode === "manual") return { value: text(transport.field_40_selected_document_number, transport.previous_document), auto, reason: "User entered Field 40 previous document manually." };
  return { value: auto, auto, reason: autoReason };
}

function bankOption(bank: BankReference) {
  return { value: bank.bank_code, label: `${bank.bank_code} — ${bank.bank_name} — ${bank.swift_code}` };
}

function paymentOption(term: PaymentTermReference) {
  return { value: term.payment_code, label: `${term.payment_code} — ${term.payment_description}` };
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function numberValue(...values: unknown[]) {
  return nullableNumber(...values) ?? 0;
}

function nullableNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (!Number.isNaN(number)) return number;
  }
  return null;
}

function cleanInvoiceNumber(value: string) {
  const blocked = new Set(["ORIGINAL", "COPY", "DATE", "DATED"]);
  return blocked.has(value.trim().toUpperCase()) ? "" : value;
}

function ErrorBanner({ message }: { message: string }) {
  return <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>;
}

function Notice({ message }: { message: string }) {
  return <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{message}</p>;
}

function StatusBadge({ status }: { status: ReviewComparisonRow["status"] }) {
  const copy = { green: "Match", red: "Mismatch", yellow: "Override only", gray: "No override" }[status];
  const classes = { green: "border-green-200 bg-green-50 text-success", red: "border-red-200 bg-red-50 text-danger", yellow: "border-amber-200 bg-amber-50 text-amber-800", gray: "border-line bg-canvas text-muted" }[status];
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${classes}`}>{copy}</span>;
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function applyProgressOverridesToPayload(payload: Pick<CustomsDeclaration, "invoice" | "packing" | "transport" | "banking">, rows: ReviewComparisonRow[]) {
  const next = {
    invoice: { ...payload.invoice },
    packing: { ...payload.packing },
    transport: { ...payload.transport },
    banking: { ...payload.banking }
  };
  for (const row of rows) {
    if (row.override_value === null || row.override_value === undefined || row.override_value === "") continue;
    const value = row.override_value;
    if (row.field === "invoice_number") next.invoice.invoice_number = String(value);
    if (row.field === "invoice_date") next.invoice.invoice_date = String(value);
    if (row.field === "freight_amount") next.invoice.freight_amount = Number(value);
    if (row.field === "insurance_amount") next.invoice.insurance_amount = Number(value);
    if (row.field === "total_packages") next.packing.total_packages = Number(value);
    if (row.field === "gross_weight") next.packing.gross_weight = Number(value);
    if (row.field === "net_weight") next.packing.net_weight = Number(value);
    if (row.field === "mawb_number") next.transport.mawb_number = String(value);
    if (row.field === "hawb_number") next.transport.hawb_number = String(value);
    if (row.field === "previous_document") {
      next.transport.previous_document = String(value);
      next.transport.field_40_selected_document_number = String(value);
    }
    if (row.field === "lc_number") next.banking.lc_number = String(value);
    if (row.field === "tt_number") next.banking.tt_number = String(value);
    if (row.field === "swift_reference") next.banking.swift_reference = String(value);
    if (row.field === "bank_code") {
      next.banking.bank_code = String(value);
      next.banking.selected_bank_code = String(value);
    }
    if (row.field === "payment_term_code") {
      next.banking.payment_term_code = String(value);
      next.banking.selected_payment_term_code = String(value);
    }
  }
  return next;
}
