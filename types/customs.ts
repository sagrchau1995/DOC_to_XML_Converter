export type CustomsType = "by_air_import" | "by_land_import" | "by_sea_or_dryport_import";

export type JobStatus =
  | "created"
  | "uploaded"
  | "queued"
  | "processing"
  | "ready_for_review"
  | "validating"
  | "validated"
  | "failed"
  | "generated";

export interface JobSummary {
  id: string;
  customs_type: CustomsType;
  status: JobStatus | string;
  progress_percentage: number;
  validation_status: string;
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  field: string;
  message: string;
  item_number?: number | null;
  extracted_value?: unknown;
  expected_value?: unknown;
  suggested_correction?: unknown;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
