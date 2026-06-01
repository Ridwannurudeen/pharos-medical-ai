// The user's medication shelf, the set every scan is checked against. The app OWNS this store
// (the Lead owns the read-only bundled interaction DB; we never read it directly).
//
// Storage: expo-secure-store, which persists values in the OS keystore (Android Keystore /
// iOS Keychain) ENCRYPTED AT REST, real OS crypto rather than a hand-rolled cipher. The shelf
// is only ever passed to scanPipeline as ShelfItem[] (no querying), so key-value storage fits.
// CAVEAT (flagged by the Lead): secure-store has a ~2 KB per-value limit on Android and a
// too-large write fails. We guard the serialized size and surface an error instead of failing
// silently. If the shelf ever needs to grow past this, move to expo-sqlite / SQLCipher.
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

import type { ShelfItem } from "../engine";

const KEY = "pharos.shelf.v1";
// Android secure-store cap is ~2048 bytes/value; stay under it with margin. Confirm the exact
// limit for the installed expo-secure-store version on-device.
const MAX_SHELF_BYTES = 1800;

// Conservative UTF-8 byte estimate (non-ASCII counted as 3, so it errs on the safe side).
const approxUtf8Bytes = (s: string): number => {
  let n = 0;
  for (const ch of s) n += (ch.codePointAt(0) ?? 0) > 0x7f ? 3 : 1;
  return n;
};

type ShelfState = {
  items: ShelfItem[];
  hydrated: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  add: (name: string) => void;
  remove: (name: string) => void;
};

async function persist(
  serialized: string,
  set: (partial: Partial<ShelfState>) => void,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, serialized);
  } catch {
    // Surface, do not swallow: a failed write means the shelf won't survive a restart.
    set({ error: "Couldn't save the shelf to this device's encrypted store." });
  }
}

export const useShelf = create<ShelfState>((set, get) => ({
  items: [],
  hydrated: false,
  error: null,
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      const items = raw ? (JSON.parse(raw) as ShelfItem[]) : [];
      set({ items, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  add: (name) => {
    const clean = name.trim();
    if (!clean) return;
    const exists = get().items.some(
      (i) => i.name.toLowerCase() === clean.toLowerCase(),
    );
    if (exists) return;
    const items = [...get().items, { name: clean }].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const serialized = JSON.stringify(items);
    if (approxUtf8Bytes(serialized) > MAX_SHELF_BYTES) {
      set({ error: "Shelf is full. Remove an item before adding more (encrypted store size limit)." });
      return;
    }
    set({ items, error: null });
    void persist(serialized, set);
  },
  remove: (name) => {
    const items = get().items.filter((i) => i.name !== name);
    set({ items, error: null });
    void persist(JSON.stringify(items), set);
  },
}));
