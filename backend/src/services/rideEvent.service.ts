import type { Prisma } from "@prisma/client";

type RecordRideEventInput = {
  rideId: string;
  rideRequestId?: string;
  fromStatus: string;
  toStatus: string;
  actorUserId: string;
  note?: string;
};

export async function recordRideEvent(
  tx: Prisma.TransactionClient,
  input: RecordRideEventInput,
) {
  return tx.rideEvent.create({
    data: {
      rideId: input.rideId,
      rideRequestId: input.rideRequestId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      note: input.note,
    },
  });
}
