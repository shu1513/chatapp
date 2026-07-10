"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // Calls are fullscreen; no chrome.
  if (pathname.startsWith("/call/")) return null;

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          chatapp
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {isPending ? null : session?.user ? (
            <>
              <Link href="/bookings" className="hover:underline">
                Bookings
              </Link>
              {session.user.role === "creator" && (
                <Link href="/dashboard" className="hover:underline">
                  Dashboard
                </Link>
              )}
              <button
                type="button"
                onClick={signOut}
                className="rounded border border-gray-300 px-3 py-1 hover:border-black dark:border-gray-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/onboard" className="hover:underline">
                Become a creator
              </Link>
              <Link
                href="/signin"
                className="rounded border border-gray-300 px-3 py-1 hover:border-black dark:border-gray-700"
              >
                Sign in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
