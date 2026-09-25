import type { Gender, Role } from "@prisma/client";

type PassengerUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  gender: Gender;
  createdAt: Date;
  passenger: {
    occupation: string;
    affiliation: string | null;
    addressZone: {
      id: number;
      name: string;
    };
  } | null;
};

export function toPassengerResponse(user: PassengerUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    gender: user.gender,
    createdAt: user.createdAt,
    passenger: user.passenger
      ? {
          occupation: user.passenger.occupation,
          affiliation: user.passenger.affiliation,
          addressZone: user.passenger.addressZone,
        }
      : null,
  };
}
