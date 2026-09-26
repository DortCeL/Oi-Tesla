import type { RideStatus, RideType } from "@prisma/client";

type RideRecord = {
  id: string;
  type: RideType;
  status: RideStatus;
  capacity: number;
  seatsTaken: number;
  arrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  pickupZone: { id: number; name: string };
};

export function toRideResponse(ride: RideRecord) {
  return {
    id: ride.id,
    type: ride.type,
    status: ride.status,
    capacity: ride.capacity,
    seatsTaken: ride.seatsTaken,
    arrivedAt: ride.arrivedAt,
    startedAt: ride.startedAt,
    completedAt: ride.completedAt,
    createdAt: ride.createdAt,
    pickupZone: ride.pickupZone,
  };
}
