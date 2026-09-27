import { RideStatus, type Prisma } from "@prisma/client";

const activeRideStatuses: RideStatus[] = [
  RideStatus.WAITING,
  RideStatus.MATCHED,
  RideStatus.IN_PROGRESS,
];

/** Apply a queued offline request once the driver has no active ride. */
export async function maybeApplyQueuedOffline(
  tx: Prisma.TransactionClient,
  driverId: string,
) {
  const driver = await tx.driver.findUnique({
    where: { userId: driverId },
    select: { offlineQueued: true },
  });

  if (!driver?.offlineQueued) {
    return;
  }

  const activeCount = await tx.ride.count({
    where: {
      driverId,
      status: { in: activeRideStatuses },
    },
  });

  if (activeCount > 0) {
    return;
  }

  await tx.driver.update({
    where: { userId: driverId },
    data: {
      isOnline: false,
      offlineQueued: false,
      activeZoneIds: [],
    },
  });
}
