type SeatMeterProps = {
  seatsTaken: number;
  capacity: number;
};

export function SeatMeter({ seatsTaken, capacity }: SeatMeterProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${seatsTaken} of ${capacity} seats filled`}
    >
      {Array.from({ length: capacity }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-3 w-3 rounded-full ${
            i < seatsTaken ? "bg-emerald-500" : "bg-gray-200"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700">
        {seatsTaken}/{capacity}
      </span>
    </div>
  );
}
