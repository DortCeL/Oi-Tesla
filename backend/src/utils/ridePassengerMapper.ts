/** Driver-facing passenger: name, where they are going, and the fare they pay. */
type DriverPassengerRecord = {
  farePaisa: number;
  destinationZone: { id: number; name: string };
  passenger: {
    user: { name: string };
  };
};

export function toDriverPassengerResponse(request: DriverPassengerRecord) {
  return {
    name: request.passenger.user.name,
    destinationZone: request.destinationZone,
    farePaisa: request.farePaisa,
  };
}

export function sumPassengerFares(requests: { farePaisa: number }[]): number {
  return requests.reduce((sum, request) => sum + request.farePaisa, 0);
}
