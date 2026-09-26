type RideEventRecord = {
  id: bigint;
  rideId: string;
  rideRequestId: string | null;
  fromStatus: string;
  toStatus: string;
  actorUserId: string;
  note: string | null;
  createdAt: Date;
};

export function toRideEventResponse(event: RideEventRecord) {
  return {
    id: event.id.toString(),
    rideId: event.rideId,
    rideRequestId: event.rideRequestId,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    actorUserId: event.actorUserId,
    note: event.note,
    createdAt: event.createdAt,
  };
}
