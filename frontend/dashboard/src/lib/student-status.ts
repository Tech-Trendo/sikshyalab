/**
 * Student account status — API ↔ UI mapping.
 * API only uses ACTIVE | INACTIVE (legacy values fall back for display).
 */

export type StudentUiStatus = "Active" | "On Hold" | "Completed" | "Deactivated";

/** Map API status → UI label */
export function studentStatusFromApi(s?: string | null): StudentUiStatus {
  switch ((s || "").toUpperCase()) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
    case "DROPPED":
    case "SUSPENDED":
      return "Deactivated";
    case "GRADUATED":
    case "COMPLETED":
      return "Completed";
    default:
      return "Active";
  }
}

/** Map UI status → API (for PATCH elsewhere — prefer deactivate/reactivate endpoints) */
export function studentStatusToApi(status?: string | null): "ACTIVE" | "INACTIVE" | undefined {
  switch (status) {
    case "Active":
    case "Completed":
      return "ACTIVE";
    case "Deactivated":
    case "On Hold":
      return "INACTIVE";
    default:
      return undefined;
  }
}

export function isStudentDeactivatedUi(status?: string | null): boolean {
  return status === "Deactivated";
}
