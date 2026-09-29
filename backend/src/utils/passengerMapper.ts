import type { Gender, Role } from "@prisma/client";

type PassengerUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  gender: Gender;
  createdAt: Date;
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
  };
}
