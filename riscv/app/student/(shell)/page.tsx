import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";
import StudentHomeRoutePreloader from "@/components/student-home-route-preloader";

type DashboardCard = {
  href: string;
  title: string;
  description: string;
  cardClassName: string;
};

const DASHBOARD_CARDS: DashboardCard[] = [
  {
    href: "/student/projects",
    title: "Projects",
    description: "Open saved workspaces and jump back into your code.",
    cardClassName: "bg-zinc-900",
  },
  {
    href: "/student/labs",
    title: "Labs",
    description: "Browse assigned labs and launch the simulator workspace.",
    cardClassName: "bg-blue-950",
  },
  {
    href: "/student/new-project",
    title: "New Project",
    description: "Create a clean project and head straight into the editor.",
    cardClassName: "bg-[#3a1218]",
  },
];

function formatWelcomeName(username: string): string {
  const cleaned = username.trim();
  if (!cleaned) return "Student";

  return cleaned
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function StudentDashboardPage() {
  const headerStore = await headers();
  const auth = readVerifiedRequestAuth(headerStore);

  if (!auth || auth.student !== true) {
    redirect("/login");
  }

  const welcomeName = formatWelcomeName(auth.username);

  return (
    <div className="mx-auto max-w-7xl py-8 md:py-10">
      <StudentHomeRoutePreloader />
      <section className="px-1 py-4 sm:px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-400">
          Home
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
          Welcome {welcomeName}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
          Pick an option or use the sidebar
        </p>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {DASHBOARD_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group relative overflow-hidden rounded-[1.75rem] border border-zinc-700/80 p-7 shadow-xl transition duration-200 hover:-translate-y-1 hover:border-zinc-300 ${card.cardClassName}`}
          >
            <div className="relative flex min-h-[21rem] flex-col justify-between">
              <div>
                <h2 className="mt-4 text-4xl font-black tracking-tight text-white">
                  {card.title}
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-200">
                  {card.description}
                </p>
              </div>

              <div className="mt-8 flex items-center justify-end">
                <span className="text-3xl font-light text-white transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
