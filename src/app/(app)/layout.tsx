import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/library", label: "Library", icon: "▤" },
  { href: "/exercises", label: "Exercises", icon: "◉" },
  { href: "/import", label: "Import", icon: "⇪" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line p-4 md:flex">
        <p className="mb-4 px-3 text-lg font-bold">Gym Tracker</p>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2 hover:bg-card">
            <span className="mr-2 text-accent">{n.icon}</span>
            {n.label}
          </Link>
        ))}
        <form action={signOut} className="mt-auto">
          <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-card">
            Sign out
          </button>
        </form>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:pb-10">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-3 bottom-3 z-10 flex justify-around rounded-full border border-line bg-card2/90 py-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center px-4 text-xs">
            <span className="text-lg text-accent">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
