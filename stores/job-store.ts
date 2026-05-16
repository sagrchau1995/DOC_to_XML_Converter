import { create } from "zustand";
import type { CustomsType } from "@/services/api";

type JobStore = {
  jobId: string;
  customsType: CustomsType;
  setJob: (jobId: string, customsType: CustomsType) => void;
};

export const useJobStore = create<JobStore>((set) => ({
  jobId: typeof window !== "undefined" ? window.localStorage.getItem("easy_customs_job_id") ?? "" : "",
  customsType: "by_air_import",
  setJob: (jobId, customsType) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("easy_customs_job_id", jobId);
      window.localStorage.setItem("current_job_id", jobId);
    }
    set({ jobId, customsType });
  }
}));
