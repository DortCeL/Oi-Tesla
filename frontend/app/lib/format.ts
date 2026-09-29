export function formatPaisa(paisa: number): string {
  return `৳${Math.round(paisa / 100).toLocaleString("en-BD")}`;
}

export function formatGender(gender: string): string {
  return gender === "MALE" ? "Male" : "Female";
}

export function formatRideType(type: string): string {
  return type === "SOLO" ? "Fully Reserved" : "Shared";
}

export function formatPoolGender(poolGender: string): string {
  if (poolGender === "FEMALE_ONLY") return "Women only";
  if (poolGender === "MALE_ONLY") return "Men only";
  return "Anyone";
}
