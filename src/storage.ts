import { createClient } from "@supabase/supabase-js";
import type { State } from "./types";
import { emptyState, validateState } from "./domain.mjs";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud = url && key ? createClient(url, key) : null;
export const storageKey = (user?: string) => `lotrdb.v1.${user ?? "guest"}`;
export function readLocal(user?: string): State {
  const raw = localStorage.getItem(storageKey(user));
  return raw ? validateState(JSON.parse(raw)) : emptyState();
}
export function writeLocal(state: State, user?: string) {
  localStorage.setItem(storageKey(user), JSON.stringify(state));
}
export function writePending(next: State, previous: State, user: string) {
  localStorage.setItem(
    `lotrdb.pending.${user}`,
    JSON.stringify({ next, previous }),
  );
}
export function clearPending(user: string) {
  localStorage.removeItem(`lotrdb.pending.${user}`);
}
export function readPending(
  user: string,
): { next: State; previous: State } | null {
  const raw = localStorage.getItem(`lotrdb.pending.${user}`);
  if (!raw) return null;
  const data = JSON.parse(raw);
  return {
    next: validateState(data.next),
    previous: validateState(data.previous),
  };
}
export async function readCloud(user: string): Promise<State> {
  if (!cloud) throw new Error("계정 저장소가 연결되지 않았습니다.");
  const results = await Promise.all(
    ["decks", "plays", "campaigns", "collections"].map((t) =>
      cloud.from(t).select("data").eq("user_id", user),
    ),
  );
  for (const r of results) if (r.error) throw r.error;
  return validateState({
    decks: results[0].data!.map((x) => x.data),
    plays: results[1].data!.map((x) => x.data),
    campaigns: results[2].data!.map((x) => x.data),
    owned: results[3].data?.[0]?.data ?? [],
  });
}
// Write only changed records. Unrelated edits on another device are never removed.
export async function saveCloud(next: State, previous: State, user: string) {
  if (!cloud) throw new Error("계정 저장소가 연결되지 않았습니다.");
  for (const table of ["decks", "plays", "campaigns"] as const) {
    const old = new Map(previous[table].map((v) => [v.id, v]));
    const changes = next[table].filter(
      (v) => JSON.stringify(old.get(v.id)) !== JSON.stringify(v),
    );
    if (changes.length) {
      const { error } = await cloud
        .from(table)
        .upsert(
          changes.map((v) => ({
            id: v.id,
            user_id: user,
            data: v,
            updated_at: new Date().toISOString(),
          })),
        );
      if (error) throw error;
    }
    const ids = new Set(next[table].map((v) => v.id));
    const deleted = previous[table]
      .filter((v) => !ids.has(v.id))
      .map((v) => v.id);
    if (deleted.length) {
      const { error } = await cloud
        .from(table)
        .delete()
        .eq("user_id", user)
        .in("id", deleted);
      if (error) throw error;
    }
  }
  if (JSON.stringify(next.owned) !== JSON.stringify(previous.owned)) {
    const { error } = await cloud
      .from("collections")
      .upsert({
        user_id: user,
        data: next.owned,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }
}
