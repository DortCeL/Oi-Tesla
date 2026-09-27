export type RideType = "SOLO" | "SHARED";
export type PaymentMethod = "CASH" | "TESLAPAY";
export type RequestStatus =
  | "REQUESTED"
  | "MATCHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type RideStatus =
  | "WAITING"
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
  baseFarePaisa: number;
  distanceChargePaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
  rideId: string | null;
  createdAt: string;
  pickupZone: Zone;
  destinationZone: Zone;
};

export type RideSummary = {
  id: string;
  status: RideStatus;
  seatsTaken: number;
  capacity: number;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type PoolMate = {
  name: string;
  gender: string;
  hobbies: string[];
  occupation: string | null;
  affiliation: string | null;
  seatsRequested: number;
  type: RideType;
  paymentMethod: PaymentMethod;
  farePaisa: number;
  destinationZone: Zone;
};

export type DriverRide = {
  id: string;
  type: RideType;
  status: RideStatus;
  capacity: number;
  seatsTaken: number;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  pickupZone: Zone;
  totalFarePaisa: number;
  passengers: { name: string; farePaisa: number }[];
};
