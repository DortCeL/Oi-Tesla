import type { Gender, Role } from "@prisma/client";

type PassengerUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  gender: Gender;
  createdAt: Date;
  hobbies: string[];
  passenger: {
    occupation: string | null;
    affiliation: string | null;
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
    hobbies: user.hobbies,
    createdAt: user.createdAt,
    passenger: user.passenger
      ? {
          occupation: user.passenger.occupation,
          affiliation: user.passenger.affiliation,
        }
      : null,
  };
}
