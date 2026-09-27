import { Link, NavLink, useNavigate } from "react-router";
import { clearAuth } from "../lib/auth.client";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

type TopNavProps = {
  name: string;
  emoji: string;
  homeTo: string;
  items: NavItem[];
};

export function TopNav({ name, emoji, homeTo, items }: TopNavProps) {
  const navigate = useNavigate();

  function logout() {
    clearAuth();
    void navigate("/login");
  }

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <Link to={homeTo} className="flex min-w-0 items-center gap-2">
          <span className="text-2xl" aria-hidden>
            {emoji}
          </span>
          <span className="truncate text-lg font-semibold text-gray-900">
            {name}
          </span>
        </Link>
        <button
          type="button"
          onClick={logout}
          className="shrink-0 text-sm text-gray-500 hover:text-gray-800"
        >
          Logout
        </button>
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-emerald-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export const passengerNav = (name: string) => (
  <TopNav
    name={name}
    emoji="🧍"
    homeTo="/passenger"
    items={[
      { to: "/passenger", label: "Book", end: true },
      { to: "/map", label: "Map" },
      { to: "/passenger/history", label: "History" },
      { to: "/passenger/profile", label: "Profile" },
    ]}
  />
);

export const driverNav = (name: string) => (
  <TopNav
    name={name}
    emoji="🛺"
    homeTo="/driver"
    items={[
      { to: "/driver", label: "Dashboard", end: true },
      { to: "/map", label: "Map" },
      { to: "/driver/history", label: "History" },
      { to: "/driver/profile", label: "Profile" },
    ]}
  />
);
