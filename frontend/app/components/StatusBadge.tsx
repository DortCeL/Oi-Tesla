const statusColors: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800 ring-amber-200",
  MATCHED: "bg-blue-100 text-blue-800 ring-blue-200",
  IN_PROGRESS: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  COMPLETED: "bg-gray-100 text-gray-700 ring-gray-200",
  CANCELLED: "bg-red-100 text-red-700 ring-red-200",
  WAITING: "bg-amber-100 text-amber-800 ring-amber-200",
};

export function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] ?? "bg-gray-100 text-gray-700 ring-gray-200";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${color}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
