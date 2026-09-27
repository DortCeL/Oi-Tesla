/** Driver-facing passenger: name and the fare they pay. */
type DriverPassengerRecord = {
  farePaisa: number;
  passenger: {
    user: { name: string };
  };
};

export function toDriverPassengerResponse(request: DriverPassengerRecord) {
  return {
    name: request.passenger.user.name,
    farePaisa: request.farePaisa,
  };
}

export function sumPassengerFares(requests: { farePaisa: number }[]): number {
  return requests.reduce((sum, request) => sum + request.farePaisa, 0);
}
