import type { DriverRide } from "../lib/types";
import { describePoolFill } from "../lib/rideCopy";

type DriverRideBannerProps = {
  ride: DriverRide;
};

export function DriverRideBanner({ ride }: DriverRideBannerProps) {
  if (ride.status === "WAITING") {
    return (
      <div className="live-banner live-banner-wait">
        <div className="live-banner-pulse" aria-hidden />
        <p className="live-banner-kicker">Open pool</p>
        <p className="live-banner-title">Waiting for more passengers</p>
        <p className="live-banner-sub">{describePoolFill(ride)}</p>
      </div>
    );
  }

  if (ride.status === "IN_PROGRESS" || ride.startedAt) {
    return (
      <div className="live-banner live-banner-progress">
        <div className="live-banner-pulse" aria-hidden />
        <p className="live-banner-kicker">On the road</p>
        <p className="live-banner-title">Trip in progress</p>
        <p className="live-banner-sub">
          Drop passengers off, then complete the ride.
        </p>
      </div>
    );
  }

  if (ride.arrivedAt) {
    return (
      <div className="live-banner live-banner-arrived">
        <div className="live-banner-pulse" aria-hidden />
        <p className="live-banner-kicker">At pickup</p>
        <p className="live-banner-title">You&apos;ve arrived</p>
        <p className="live-banner-sub">
          Passengers can see you&apos;re here. Start the ride when everyone is in.
        </p>
      </div>
    );
  }

  if (ride.status === "MATCHED") {
    return (
      <div className="live-banner live-banner-enroute">
        <div className="live-banner-orbit" aria-hidden>
          <span className="live-banner-orbit-dot" />
        </div>
        <p className="live-banner-kicker">En route</p>
        <p className="live-banner-title">Head to the pickup</p>
        <p className="live-banner-sub">
          Passengers are waiting at {ride.pickupZone.name}. Mark arrived when you get there.
        </p>
      </div>
    );
  }

  return null;
}