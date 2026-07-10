"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Site-wide header + footer. Fullscreen surfaces (calls) get no chrome.
 *
 * The pathname gate lives here, once, ABOVE the session hook so hidden
 * pages never pay for a session fetch. If more fullscreen routes appear,
 * prefer moving chrome into a (main) route-group layout over growing
 * this prefix list.
 */
const CHROMELESS_PREFIXES = ["/call/"];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const chromeless = CHROMELESS_PREFIXES.some((p) => pathname.startsWith(p));

  if (chromeless) return <>{children}</>;

  return (
    <>
      <Header />
      {children}
      <footer className="mt-auto border-t border-gray-200 py-6 text-center text-xs text-gray-500 dark:border-gray-800">
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/refunds" className="hover:underline">
          Refunds
        </Link>
      </footer>
    </>
  );
}

function Header() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch {
      // Leave the header interactive; the user can retry.
      setSigningOut(false);
    }
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
                disabled={signingOut}
                className="rounded border border-gray-300 px-3 py-1 hover:border-black disabled:opacity-50 dark:border-gray-700"
              >
                {signingOut ? "Signing out…" : "Sign out"}
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
