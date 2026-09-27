import { formatPaisa } from "../lib/format";

type PassengerListProps = {
  passengers: { name: string; farePaisa: number }[];
  emptyMessage?: string;
};

export function PassengerList({ passengers, emptyMessage }: PassengerListProps) {
  if (passengers.length === 0) {
    return emptyMessage ? (
      <p className="text-sm text-gray-500">{emptyMessage}</p>
    ) : null;
  }

  return (
    <ul className="space-y-2">
      {passengers.map((passenger, index) => (
        <li
          key={`${passenger.name}-${index}`}
          className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-3 ring-1 ring-gray-100"
        >
          <p className="font-semibold text-gray-900">{passenger.name}</p>
          <p className="shrink-0 text-sm font-semibold text-emerald-800">
            {formatPaisa(passenger.farePaisa ?? 0)}
          </p>
        </li>
      ))}
    </ul>
  );
}
