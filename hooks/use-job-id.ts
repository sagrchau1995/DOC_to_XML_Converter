"use client";

import { useEffect, useState } from "react";
import { useJobStore } from "@/stores/job-store";

export function useJobId() {
  const storedJobId = useJobStore((state) => state.jobId);
  const [queryJobId, setQueryJobId] = useState("");

  useEffect(() => {
    const paramsJobId = new URLSearchParams(window.location.search).get("job_id") ?? "";
    const currentJobId = window.localStorage.getItem("current_job_id") ?? "";
    const legacyJobId = window.localStorage.getItem("easy_customs_job_id") ?? "";
    const resolved = paramsJobId || currentJobId || legacyJobId;
    if (resolved) {
      window.localStorage.setItem("current_job_id", resolved);
      window.localStorage.setItem("easy_customs_job_id", resolved);
    }
    setQueryJobId(resolved);
  }, []);

  return queryJobId || storedJobId;
}
