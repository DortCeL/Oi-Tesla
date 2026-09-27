export type RideType = "SOLO" | "SHARED";
export type PaymentMethod = "CASH" | "TESLAPAY";
export type RequestStatus =
  | "REQUESTED"
  | "MATCHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type Zone = {
  id: number;
  name: string;
};

export type FareEstimate = {
  distanceM: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
};

export type RideRequest = {
  id: string;
  status: RequestStatus;
  type: RideType;
  seatsRequested: number;
  paymentMethod: PaymentMethod;
  farePaisa: number;
  rideId: string | null;
  pickupZone: Zone;
  destinationZone: Zone;
};
