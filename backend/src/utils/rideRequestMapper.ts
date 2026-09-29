import type {
  PaymentMethod,
  PoolGenderPreference,
  RequestStatus,
  RideType,
} from "@prisma/client";

type RideRequestRecord = {
  id: string;
  status: RequestStatus;
  type: RideType;
  poolGender: PoolGenderPreference;
  seatsRequested: number;
  paymentMethod: PaymentMethod;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
  rideId: string | null;
  createdAt: Date;
  pickupZone: { id: number; name: string };
  destinationZone: { id: number; name: string };
};

export function toRideRequestResponse(request: RideRequestRecord) {
  return {
    id: request.id,
    status: request.status,
    type: request.type,
    poolGender: request.poolGender,
    seatsRequested: request.seatsRequested,
    paymentMethod: request.paymentMethod,
    baseFarePaisa: request.baseFarePaisa,
    distanceChargePaisa: request.distanceChargePaisa,
    poolDiscountPaisa: request.poolDiscountPaisa,
    farePaisa: request.farePaisa,
    rideId: request.rideId,
    createdAt: request.createdAt,
    pickupZone: request.pickupZone,
    destinationZone: request.destinationZone,
  };
}
