import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators } from "@/db/schema";

// Creator list is live data — never prerender at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const featured = await db.query.creators.findMany({
    where: eq(creators.status, "active"),
    limit: 12,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 p-6 pt-24">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold">
          Talk to your favorite creators, face to face.
        </h1>
        <p className="text-lg text-gray-600">
          Book a private video call with a creator you follow, or take calls
          from your fans and get paid for your time.
        </p>
      </header>
      <div className="flex gap-3">
        <Link
          href="/onboard"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Become a creator
        </Link>
        <Link
          href="/signin"
          className="rounded border border-gray-300 px-4 py-2"
        >
          Sign in
        </Link>
      </div>
      {featured.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Creators</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {featured.map((c) => (
              <li key={c.userId}>
                <Link
                  href={`/@${c.handle}`}
                  className="flex flex-col gap-1 rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  <span className="font-medium">{c.displayName}</span>
                  <span className="text-sm text-gray-500">@{c.handle}</span>
                  <span className="text-sm">
                    ${(c.rateCents / 100).toFixed(0)} ·{" "}
                    {c.callLengthMin} min
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
