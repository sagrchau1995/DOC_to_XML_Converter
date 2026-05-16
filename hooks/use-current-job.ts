import type { JobSummary } from "@/types/customs";

export function useCurrentJob(): { job: JobSummary | null; setJob: (job: JobSummary | null) => void } {
  // TODO: Replace with a durable client store once authenticated workflows are wired.
  return {
    job: null,
    setJob: () => undefined
  };
}

