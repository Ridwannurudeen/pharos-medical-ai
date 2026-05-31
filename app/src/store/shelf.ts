// The user's medication shelf — the set every scan is checked against. The app OWNS this store
// (the Lead owns the read-only bundled interaction DB; we never read it directly).
//
// Storage: expo-secure-store, which persists values in the OS keystore (Android Keystore /
// iOS Keychain) ENCRYPTED AT REST. The shelf is a short list of drug names, well within
// secure-store limits, so this satisfies the "encrypted shelf" requirement with real OS
// crypto rather than a hand-rolled cipher. If the shelf later grows relational, move to
// expo-sqlite plus field encryption keyed from secure-store. Decision flagged to the Lead.
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

import type { ShelfItem } from "../engine";

const KEY = "pharos.shelf.v1";

type ShelfState = {
  items: ShelfItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (name: string) => void;
  remove: (name: string) => void;
};

async function persist(items: ShelfItem[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(items));
  } catch {
    // SecureStore unavailable (e.g. web preview); keep this session in memory only.
  }
}

export const useShelf = create<ShelfState>((set, get) => ({
  items: [],
  hydrated: false,
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
    set({ items });
    void persist(items);
  },
  remove: (name) => {
    const items = get().items.filter((i) => i.name !== name);
    set({ items });
    void persist(items);
  },
}));
