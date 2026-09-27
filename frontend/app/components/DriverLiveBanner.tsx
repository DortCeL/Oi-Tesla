type DriverLiveBannerProps = {
  driverName: string | null;
  rideStatus: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
};

export function DriverLiveBanner({
  driverName,
  rideStatus,
  arrivedAt,
  startedAt,
}: DriverLiveBannerProps) {
  const driverLabel = driverName ? `${driverName} 🛺` : "Your driver 🛺";

  if (!rideStatus || rideStatus === "WAITING") {
    return (
      <div className="live-banner live-banner-wait">
        <div className="live-banner-pulse" aria-hidden />
        <p className="live-banner-kicker">Finding your pool</p>
        <p className="live-banner-title">Waiting for more passengers</p>
        <p className="live-banner-sub">
          {driverName
            ? `${driverLabel} has your Tesla. Cancel is still available until the pool locks.`
            : "Your Tesla is reserved. Cancel is still available until the pool locks."}
        </p>
      </div>
    );
  }

  if (startedAt || rideStatus === "IN_PROGRESS") {
    return (
      <div className="live-banner live-banner-progress">
        <div className="live-banner-pulse" aria-hidden />
        <p className="live-banner-kicker">On the move</p>
        <p className="live-banner-title">Ride in progress</p>
        <p className="live-banner-sub">
          {driverLabel} is driving you to your destination.
        </p>
      </div>
    );
  }

  if (arrivedAt) {
    return (
      <div className="live-banner live-banner-arrived">
        <div className="live-banner-pulse" aria-hidden />
        <p className="live-banner-kicker">Driver here</p>
        <p className="live-banner-title">{driverLabel} has arrived</p>
        <p className="live-banner-sub">Look for the Tesla at the pickup point.</p>
      </div>
    );
  }

  if (rideStatus === "MATCHED") {
    return (
      <div className="live-banner live-banner-enroute">
        <div className="live-banner-orbit" aria-hidden>
          <span className="live-banner-orbit-dot" />
        </div>
        <p className="live-banner-kicker">En route</p>
        <p className="live-banner-title">{driverLabel} is coming to you</p>
        <p className="live-banner-sub">Heading to the pickup zone now.</p>
      </div>
    );
  }

  return null;
}
