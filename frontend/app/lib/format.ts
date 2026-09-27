export function formatPaisa(paisa: number): string {
  return `৳${Math.round(paisa / 100).toLocaleString("en-BD")}`;
}

export function formatRideType(type: string): string {
  return type === "SOLO" ? "Fully Reserved" : "Shared";
}
