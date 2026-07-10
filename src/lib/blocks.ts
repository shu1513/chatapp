import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { blocks } from "@/db/schema";

/** True when `blockerId` has blocked `blockedId`. */
export async function isBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const row = await db.query.blocks.findFirst({
    where: and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)),
  });
  return row !== undefined;
}
