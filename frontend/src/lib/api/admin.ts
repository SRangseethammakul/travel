import { notFound } from "next/navigation";
import { ApiError, apiFetch } from "./http";
import type {
  AdminOverview,
  AdminPage,
  AdminSystem,
  AdminTripDetail,
  AdminTripRow,
  AdminUserDetail,
  AdminUserRow,
  ID,
  User,
} from "./types";

/** Query string from the non-empty entries (admin list filters live in the page URL). */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Admin endpoints answer 404 `not_found` to non-Admins (and for unknown ids); show the app's normal 404. */
async function admin<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(`/api/admin${path}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

/** GET /api/admin/whoami — the signed-in Admin (404 → notFound() for anyone else). */
export async function getAdmin(): Promise<User> {
  return (await admin<{ user: User }>("/whoami")).user;
}

export const getAdminOverview = (days: number) => admin<AdminOverview>(`/overview${qs({ days })}`);

export interface AdminUsersQuery {
  q?: string;
  provider?: string;
  sort?: string;
  dir?: string;
  page?: number;
}
export const getAdminUsers = (query: AdminUsersQuery) => admin<AdminPage<AdminUserRow>>(`/users${qs({ ...query })}`);
export const getAdminUser = (id: ID) => admin<AdminUserDetail>(`/users/${encodeURIComponent(id)}`);

export interface AdminTripsQuery {
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: number;
}
export const getAdminTrips = (query: AdminTripsQuery) => admin<AdminPage<AdminTripRow>>(`/trips${qs({ ...query })}`);
export const getAdminTrip = (id: ID) => admin<AdminTripDetail>(`/trips/${encodeURIComponent(id)}`);

export const getAdminSystem = (query: { filter?: string; page?: number }) => admin<AdminSystem>(`/system${qs(query)}`);
