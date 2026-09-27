import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup/passenger", "routes/signup.passenger.tsx"),
  route("signup/driver", "routes/signup.driver.tsx"),
  route("passenger", "routes/passenger.tsx"),
  route("passenger/profile", "routes/passenger.profile.tsx"),
  route("passenger/searching/:requestId", "routes/passenger.searching.$requestId.tsx"),
  route("passenger/ride/:requestId", "routes/passenger.ride.$requestId.tsx"),
  route("passenger/history", "routes/passenger.history.tsx"),
  route("driver", "routes/driver.tsx"),
  route("map", "routes/map.tsx"),
] satisfies RouteConfig;
