import type { Gender, Role, Tesla } from "@prisma/client";

type DriverUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  gender: Gender;
  createdAt: Date;
  driver: {
    isOnline: boolean;
    activeZoneIds: number[];
    teslas: Pick<Tesla, "id" | "name" | "capacity" | "isActive">[];
  } | null;
};

export function toDriverResponse(user: DriverUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    gender: user.gender,
    createdAt: user.createdAt,
    driver: user.driver
      ? {
          isOnline: user.driver.isOnline,
          activeZoneIds: user.driver.activeZoneIds,
          teslas: user.driver.teslas,
        }
      : null,
  };
}
