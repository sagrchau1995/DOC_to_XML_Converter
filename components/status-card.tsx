import { clsx } from "clsx";

export function StatusCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" | "warning" }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className={clsx("mt-2 text-2xl font-black", tone === "success" && "text-success", tone === "danger" && "text-danger", tone === "warning" && "text-amber")}>{value}</p>
    </div>
  );
}
