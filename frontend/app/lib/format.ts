export function formatPaisa(paisa: number): string {
  return `৳${Math.round(paisa / 100).toLocaleString("en-BD")}`;
}

export function formatGender(gender: string): string {
  return gender === "MALE" ? "Male" : "Female";
}

export function formatRideType(type: string): string {
  return type === "SOLO" ? "Fully Reserved" : "Shared";
}

/** Own profile only. Blank optional fields read as N/A. */
export function displayOptional(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "N/A";
}

export function displayHobbies(hobbies: string[]): string {
  const items = hobbies.map((hobby) => hobby.trim()).filter(Boolean);
  return items.length > 0 ? items.join(", ") : "N/A";
}
