"use client";

import { useActionState } from "react";
import {
  resolveReport,
  setCreatorSuspended,
  type AdminState,
} from "./actions";

type Report = {
  id: string;
  reason: string;
  createdAt: string;
  reporterEmail: string;
  reportedEmail: string;
  reportedUserId: string;
  reportedCreatorStatus: string | null;
};

export function AdminReportRow({ report }: { report: Report }) {
  const [, resolveAction, resolvePending] = useActionState<
    AdminState,
    FormData
  >(resolveReport, {});
  const [, suspendAction, suspendPending] = useActionState<
    AdminState,
    FormData
  >(setCreatorSuspended, {});

  const isCreator = report.reportedCreatorStatus !== null;
  const suspended = report.reportedCreatorStatus === "suspended";

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">
        {report.createdAt.slice(0, 16).replace("T", " ")} ·{" "}
        {report.reporterEmail} reported {report.reportedEmail}
        {isCreator && ` (creator${suspended ? ", suspended" : ""})`}
      </p>
      <p className="whitespace-pre-wrap text-sm">{report.reason}</p>
      <div className="flex gap-2">
        <form action={resolveAction}>
          <input type="hidden" name="reportId" value={report.id} />
          <button
            type="submit"
            disabled={resolvePending}
            className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Resolve
          </button>
        </form>
        <form action={resolveAction}>
          <input type="hidden" name="reportId" value={report.id} />
          <input type="hidden" name="decision" value="dismiss" />
          <button
            type="submit"
            disabled={resolvePending}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Dismiss
          </button>
        </form>
        {isCreator && (
          <form action={suspendAction}>
            <input type="hidden" name="userId" value={report.reportedUserId} />
            <input type="hidden" name="suspend" value={String(!suspended)} />
            <button
              type="submit"
              disabled={suspendPending}
              className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-50"
            >
              {suspended ? "Unsuspend creator" : "Suspend creator"}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
