import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators } from "@/db/schema";
import { getSession } from "@/lib/session";
import { ProfileForm } from "./form";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin?next=/dashboard/profile");
  }
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (!creator) {
    redirect("/onboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6 pt-12">
      <header>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your page:{" "}
          <Link href={`/@${creator.handle}`} className="underline">
            @{creator.handle}
          </Link>{" "}
          (handle can&apos;t be changed)
        </p>
      </header>
      <ProfileForm
        initial={{
          displayName: creator.displayName,
          bio: creator.bio ?? "",
          rateUsd: creator.rateCents / 100,
          callLengthMin: creator.callLengthMin,
          approvalMode: creator.approvalMode,
        }}
      />
    </main>
  );
}
