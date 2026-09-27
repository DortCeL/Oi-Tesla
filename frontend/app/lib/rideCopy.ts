import type { DriverRide } from "./types";

export function describePoolFill(ride: DriverRide): string {
  const open = ride.capacity - ride.seatsTaken;

  if (ride.status === "COMPLETED") {
    return "Trip completed";
  }
  if (ride.status === "IN_PROGRESS") {
    return `En route · ${ride.seatsTaken}/${ride.capacity} seats in use`;
  }
  if (ride.type === "SOLO") {
    return "Fully reserved — entire vehicle locked";
  }
  if (ride.status === "MATCHED") {
    if (ride.arrivedAt && !ride.startedAt) {
      return `Arrived · ${ride.seatsTaken}/${ride.capacity} passengers ready to go`;
    }
    return `Locked · ${ride.seatsTaken}/${ride.capacity} passengers onboard`;
  }
  if (ride.status === "WAITING") {
    if (open <= 0) {
      return `${ride.seatsTaken}/${ride.capacity} filled — pool full`;
    }
    return `${ride.seatsTaken}/${ride.capacity} filled — waiting for ${open} more seat${open === 1 ? "" : "s"}`;
  }
  return `${ride.seatsTaken}/${ride.capacity} seats`;
}
