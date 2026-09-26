import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("passenger", "routes/passenger.tsx"),
  route("driver", "routes/driver.tsx"),
] satisfies RouteConfig;
