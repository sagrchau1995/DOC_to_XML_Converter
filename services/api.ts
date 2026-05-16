const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");
const isDev = process.env.NODE_ENV !== "production";

export type CustomsType = "by_air_import" | "by_land_import" | "by_sea_import" | "by_dryport_import" | "by_sea_or_dryport_import";
export type CustomsTypeInput = CustomsType | "BY_AIR_IMPORT" | "BY_LAND_IMPORT" | "BY_SEA_IMPORT" | "BY_DRYPORT_IMPORT" | "BY_SEA_OR_DRYPORT_IMPORT";
export type DocumentType =
  | "invoice"
  | "airway_bill"
  | "indian_customs_document"
  | "packing_list"
  | "master_air_waybill"
  | "house_air_waybill"
  | "bill_of_lading"
  | "freight_document"
  | "delivery_order"
  | "banking_document"
  | "country_of_origin"
  | "insurance_document"
  | "other_document"
  | "supporting_documents"
  | "other"
  | "xml_template";

export type DocumentUploadInput = {
  documentCode?: string;
  documentType: string;
  originalFilename?: string;
  metadata?: Record<string, unknown>;
  file: File;
};

export type JobRead = {
  id: string;
  job_id: string;
  customs_type: CustomsType;
  status: string;
  progress_percentage: number;
  validation_status: string;
  user_prompt?: string | null;
};

export type JobProgress = {
  job_id: string;
  status: string;
  progress_percent: number;
  current_stage: string;
  document_statuses?: Array<{ document_id: string; document_code?: string; document_type?: string; filename: string; upload_status: string; extraction_status: string; output_path?: string }>;
  provider_warnings?: Array<{ stage?: string; message: string; created_at?: string }>;
  latest_error?: string;
  next_allowed_action?: string;
  events: Array<{ stage: string; progress_percent: number; message: string; created_at: string }>;
};

export type ReviewComparisonRow = {
  field: string;
  system_value: unknown;
  override_value: unknown;
  status: "green" | "red" | "yellow" | "gray";
  final_value: unknown;
};

export type GeneratedFile = {
  id: string;
  job_id: string;
  file_type: string;
  sha256: string;
  created_at: string;
};

export type ExtractedData = {
  job_id: string;
  status: string;
  declaration: CustomsDeclaration | null;
  general?: Record<string, unknown> | null;
};

export type CustomsDeclaration = {
  customs_type: CustomsType;
  user_prompt?: string;
  invoice: {
    invoice_number: string;
    invoice_date: string;
    proforma_invoice_number?: string;
    proforma_invoice_date?: string;
    final_xml_invoice_number?: string;
    final_xml_invoice_date?: string;
    invoice_reference_source?: string;
    exporter: { name: string; address?: string; country_code?: string; tax_id?: string; exim_code?: string };
    importer: { name: string; address?: string; country_code?: string; tax_id?: string; exim_code?: string };
    currency: string;
    incoterm: string;
    normalized_incoterm?: string;
    incoterm_place?: string;
    payment_terms_text?: string;
    destination?: string;
    country_of_origin?: string;
    invoice_total: number;
    freight_amount?: number | null;
    freight_currency?: string;
    freight_source?: string;
    freight_reviewed?: boolean;
    insurance_amount?: number | null;
    insurance_currency?: string;
    insurance_source?: string;
    insurance_reviewed?: boolean;
    exchange_rate?: number | null;
    items: InvoiceItem[];
  };
  packing: Record<string, unknown>;
  transport: Record<string, unknown>;
  banking: Record<string, unknown>;
  origin?: Record<string, unknown>;
  review: { reviewed_by?: string; reviewed_at?: string; approved_for_xml_generation: boolean };
  manual_overrides: Array<Record<string, unknown>>;
};

export type InvoiceItem = {
  line_number: number;
  description: string;
  commercial_description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  brand?: string;
  model?: string;
  size?: string;
  origin_country_code?: string;
  invoice_hs_code?: string;
  ai_suggested_hs_code?: string;
  nepal_hs_code?: string;
  tariff_description?: string;
  primary_unit?: string;
  supplementary_unit?: string;
  supplementary_unit_name?: string;
  supplementary_quantity?: number | null;
  hs_match_type?: string;
  hs_confidence?: number;
  hs_reason?: string;
  hs_suggestions?: Array<Record<string, unknown>>;
  hs_manually_approved?: boolean;
  package_count?: number | null;
  gross_weight?: number | null;
  net_weight?: number | null;
  package_kind?: string;
  review_required?: boolean;
  review_notes?: string[];
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("easy_customs_token") : "";
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const url = `${API_BASE}${path}`;
  if (isDev) {
    console.debug("[easy-customs-api]", init.method ?? "GET", url);
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body || `${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(body) as { detail?: unknown; message?: unknown; error?: unknown };
      const detail = parsed.detail ?? parsed.message ?? parsed.error;
      if (typeof detail === "string") message = detail;
      if (Array.isArray(detail)) message = detail.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join("; ");
    } catch {
      // keep raw response body
    }
    if (response.status === 401) {
      message = "Unauthorized. For local development, set AUTH_MODE=dev.";
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  return api<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export type BankReference = { bank_code: string; bank_name: string; swift_code: string };
export type PaymentTermReference = { payment_code: string; payment_description: string; aliases?: string };

export async function createJob(customsType: CustomsTypeInput, userPrompt = "") {
  return api<JobRead>("/jobs", {
    method: "POST",
    body: JSON.stringify({ customs_type: customsType, user_prompt: userPrompt })
  });
}

export async function getJobStatus(jobId: string) {
  return api<JobProgress>(`/jobs/${jobId}/status`);
}

export async function uploadDocument(jobId: string, documentTypeOrInput: DocumentType | DocumentUploadInput, maybeFile?: File) {
  const form = new FormData();
  if (typeof documentTypeOrInput === "string") {
    if (!maybeFile) throw new Error("file is required.");
    form.append("document_type", documentTypeOrInput);
    form.append("file", maybeFile);
  } else {
    form.append("document_type", documentTypeOrInput.documentType);
    if (documentTypeOrInput.documentCode) form.append("document_code", documentTypeOrInput.documentCode);
    if (documentTypeOrInput.originalFilename) form.append("original_filename", documentTypeOrInput.originalFilename);
    if (documentTypeOrInput.metadata) form.append("metadata", JSON.stringify(documentTypeOrInput.metadata));
    form.append("file", documentTypeOrInput.file);
  }
  return api<Record<string, unknown>>(`/jobs/${jobId}/documents`, {
    method: "POST",
    body: form
  });
}

export async function startExtraction(jobId: string) {
  return api<{ job_id: string; status: string; progress_percent: number }>(`/jobs/${jobId}/extract`, { method: "POST" });
}

export async function cancelExtraction(jobId: string) {
  return api<{ job_id: string; status: string }>(`/jobs/${jobId}/cancel-extraction`, { method: "POST" });
}

export async function saveProgressOverrides(jobId: string, overrides: Record<string, string>) {
  return api<{ job_id: string; overrides: Record<string, string>; stage: string }>(`/jobs/${jobId}/overrides`, {
    method: "POST",
    body: JSON.stringify({ overrides, stage: "progress_page_user_override" })
  });
}

export async function getProgressOverrides(jobId: string) {
  return api<{ job_id: string; overrides: Record<string, unknown> }>(`/jobs/${jobId}/overrides`);
}

export async function getReviewComparison(jobId: string) {
  return api<{ job_id: string; rows: ReviewComparisonRow[] }>(`/jobs/${jobId}/review-comparison`);
}

export async function getExtractedData(jobId: string) {
  return api<ExtractedData>(`/jobs/${jobId}/extracted-data`);
}

export async function getBanks() {
  return api<BankReference[]>("/reference/banks");
}

export async function getPaymentTerms() {
  return api<PaymentTermReference[]>("/reference/payment-terms");
}

export async function updateGeneralData(jobId: string, invoice: CustomsDeclaration["invoice"]) {
  return api<{ job_id: string; declaration: CustomsDeclaration }>(`/jobs/${jobId}/general-data`, {
    method: "PUT",
    body: JSON.stringify(invoice)
  });
}

export async function updateGeneralReview(jobId: string, payload: Pick<CustomsDeclaration, "invoice" | "packing" | "transport" | "banking">) {
  return api<{ job_id: string; declaration: CustomsDeclaration }>(`/jobs/${jobId}/general-data`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function updateItems(jobId: string, items: InvoiceItem[]) {
  return api<{ job_id: string; declaration: CustomsDeclaration }>(`/jobs/${jobId}/items`, {
    method: "PUT",
    body: JSON.stringify(items)
  });
}

export async function updateBanking(jobId: string, banking: CustomsDeclaration["banking"]) {
  return api<{ job_id: string; declaration: CustomsDeclaration }>(`/jobs/${jobId}/banking`, {
    method: "PUT",
    body: JSON.stringify(banking)
  });
}

export async function updateTransport(jobId: string, transport: CustomsDeclaration["transport"]) {
  return api<{ job_id: string; declaration: CustomsDeclaration }>(`/jobs/${jobId}/transport`, {
    method: "PUT",
    body: JSON.stringify(transport)
  });
}

export async function validateJob(jobId: string) {
  return api<{ valid: boolean; errors: Array<Record<string, unknown>>; warnings: Array<Record<string, unknown>> }>(`/jobs/${jobId}/validate`, { method: "POST" });
}

export async function generateXml(jobId: string) {
  return api<{ job_id: string; status: string; files: Array<{ id: string; file_type: string }> }>(`/jobs/${jobId}/generate-xml`, { method: "POST" });
}

export async function getGeneratedFiles(jobId: string) {
  return api<GeneratedFile[]>(`/jobs/${jobId}/generated-files`);
}

export function downloadUrl(jobId: string, artifact: "xml" | "brand-model-size" | "validation-report" | "extraction-audit") {
  return `${API_BASE}/jobs/${jobId}/download/${artifact}`;
}
