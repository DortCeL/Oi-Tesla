import { formatPaisa } from "../lib/format";
import type { Zone } from "../lib/types";

type PassengerListProps = {
  passengers: { name: string; farePaisa: number; destinationZone?: Zone }[];
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
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{passenger.name}</p>
            {passenger.destinationZone ? (
              <p className="text-sm text-gray-500">To {passenger.destinationZone.name}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-sm font-semibold text-emerald-800">
            {formatPaisa(passenger.farePaisa ?? 0)}
          </p>
        </li>
      ))}
    </ul>
  );
}
