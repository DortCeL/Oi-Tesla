import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Oi Tesla" },
    {
      name: "description",
      content: "Share a seat. Split the fare. Survive Dhaka traffic.",
    },
  ];
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Oi Tesla
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Dhaka Tesla Pool</h1>
        <p className="mt-2 text-gray-600">
          Share a seat. Split the fare. Survive Dhaka traffic.
        </p>
      </div>
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
      </p>
    </main>
  );
}
