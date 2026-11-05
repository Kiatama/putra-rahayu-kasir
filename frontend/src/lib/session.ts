import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/types";

// /auth/me 401s when logged out — normalise to null instead of a query error.
export async function fetchMe(): Promise<User | null> {
  try {
    return await apiGet<User>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false, staleTime: 30_000 });
}

// Call after a successful login: the new httpOnly cookie answers /auth/me.
export async function beginSession(user: User) {
  queryClient.setQueryData(["me"], user);
  await queryClient.invalidateQueries({ queryKey: ["me"] });
}

// Every sign-out control must go through here — clear() wipes the cached account data
// so the next login on this browser cannot render the previous account's cache.
export async function endSession() {
  try {
    await apiPost("/auth/logout");
  } finally {
    queryClient.clear();
  }
}