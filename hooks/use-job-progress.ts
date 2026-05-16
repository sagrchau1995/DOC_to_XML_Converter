export interface JobProgress {
  job_id: string;
  status: string;
  progress_percent: number;
  current_stage: string;
}

export function useJobProgress(_jobId: string | null): { progress: JobProgress | null; isLoading: boolean } {
  // TODO: Wire to backend polling/SSE endpoint when frontend API workflow is implemented.
  return { progress: null, isLoading: false };
}

