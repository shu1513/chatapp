"use client";

import { useEffect, useState } from "react";

/** Renders an instant in the viewer's local timezone (client-side only). */
export function LocalTime({
  iso,
  withDate = true,
}: {
  iso: string;
  withDate?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    setText(
      d.toLocaleString(undefined, {
        ...(withDate
          ? { weekday: "short", month: "short", day: "numeric" }
          : {}),
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [iso, withDate]);
  return <span suppressHydrationWarning>{text ?? "…"}</span>;
}
