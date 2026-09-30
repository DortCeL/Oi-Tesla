import { authJson } from "./fetch.client";

export type PassengerMeUser = {
  name: string;
  email: string;
  phone: string;
  gender: "MALE" | "FEMALE";
};

const byToken = new Map<string, Promise<{ user: PassengerMeUser }>>();

/** Profile fields are read-only, so one fetch per login is enough. */
export function loadPassengerMe(token: string): Promise<{ user: PassengerMeUser }> {
  let pending = byToken.get(token);
  if (!pending) {
    pending = authJson<{ user: PassengerMeUser }>("/auth/passenger/me").catch((err: unknown) => {
      byToken.delete(token);
      throw err;
    });
    byToken.set(token, pending);
  }
  return pending;
}
