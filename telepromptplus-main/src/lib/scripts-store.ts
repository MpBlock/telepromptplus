export type Script = {
  id: string;
  title: string;
  content: string;
  category: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Recording = {
  id: string;
  title: string;
  scriptId?: string;
  duration: number;
  size: number;
  url: string; // object URL or blob ref
  blob?: Blob;
  createdAt: number;
};

const KEY_SCRIPTS = "tp.scripts.v1";
const KEY_CATS = "tp.categories.v1";
const KEY_SETTINGS = "tp.settings.v1";

export const DEFAULT_CATEGORIES = ["Geral", "YouTube", "Podcast", "Reels", "Apresentação"];

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(k: string, v: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify(v));
}

export const scriptsStore = {
  list(): Script[] {
    const all = read<Script[]>(KEY_SCRIPTS, []);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string) {
    return this.list().find((s) => s.id === id);
  },
  upsert(s: Partial<Script> & { id?: string; title: string; content: string }): Script {
    const all = read<Script[]>(KEY_SCRIPTS, []);
    const now = Date.now();
    if (s.id) {
      const i = all.findIndex((x) => x.id === s.id);
      if (i >= 0) {
        all[i] = { ...all[i], ...s, updatedAt: now } as Script;
        write(KEY_SCRIPTS, all);
        return all[i];
      }
    }
    const created: Script = {
      id: crypto.randomUUID(),
      title: s.title || "Sem título",
      content: s.content || "",
      category: s.category || "Geral",
      favorite: s.favorite ?? false,
      createdAt: now,
      updatedAt: now,
    };
    all.push(created);
    write(KEY_SCRIPTS, all);
    return created;
  },
  remove(id: string) {
    write(
      KEY_SCRIPTS,
      read<Script[]>(KEY_SCRIPTS, []).filter((s) => s.id !== id),
    );
  },
  toggleFavorite(id: string) {
    const all = read<Script[]>(KEY_SCRIPTS, []);
    const i = all.findIndex((s) => s.id === id);
    if (i >= 0) {
      all[i].favorite = !all[i].favorite;
      write(KEY_SCRIPTS, all);
    }
  },
  categories(): string[] {
    return read<string[]>(KEY_CATS, DEFAULT_CATEGORIES);
  },
  addCategory(name: string) {
    const cats = this.categories();
    if (!cats.includes(name)) {
      cats.push(name);
      write(KEY_CATS, cats);
    }
  },
};

export type Settings = {
  theme: "dark" | "light";
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fontColor: string;
  bgColor: string;
  align: "left" | "center" | "right";
  speed: number;
  mirrorH: boolean;
  mirrorV: boolean;
  countdown: 0 | 3 | 5 | 10;
  resolution: "720p" | "1080p" | "max";
  camera: "user" | "environment";
  cameraSize: "sm" | "md" | "lg" | "full";
  voicePause: boolean;
  voiceThreshold: number; // 0..100
  voiceSilenceMs: number; // ms of silence before pausing
};

export const defaultSettings: Settings = {
  theme: "dark",
  fontSize: 56,
  lineHeight: 1.5,
  fontFamily: "Space Grotesk",
  fontColor: "#ffffff",
  bgColor: "#000000",
  align: "center",
  speed: 50,
  mirrorH: false,
  mirrorV: false,
  countdown: 3,
  resolution: "1080p",
  camera: "user",
  cameraSize: "md",
  voicePause: false,
  voiceThreshold: 12,
  voiceSilenceMs: 1200,
};

export const settingsStore = {
  get(): Settings {
    return { ...defaultSettings, ...read<Partial<Settings>>(KEY_SETTINGS, {}) };
  },
  set(s: Partial<Settings>) {
    write(KEY_SETTINGS, { ...this.get(), ...s });
  },
};

// Recordings persisted in IndexedDB (blobs survive reload/navigation)
const DB_NAME = "tp-recordings";
const STORE = "recordings";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type StoredRecording = Omit<Recording, "url"> & { blob: Blob };

export const recordingsStore = {
  async list(): Promise<Recording[]> {
    if (typeof window === "undefined") return [];
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      tx.onsuccess = () => {
        const items = (tx.result as StoredRecording[]) || [];
        const recs = items
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((r) => ({ ...r, url: URL.createObjectURL(r.blob) }));
        resolve(recs);
      };
      tx.onerror = () => resolve([]);
    });
  },
  async add(r: Omit<Recording, "url"> & { blob: Blob }) {
    if (typeof window === "undefined") return;
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put({
        id: r.id,
        title: r.title,
        scriptId: r.scriptId,
        duration: r.duration,
        size: r.size,
        createdAt: r.createdAt,
        blob: r.blob,
      });
      tx.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async remove(id: string) {
    if (typeof window === "undefined") return;
    const db = await openDB();
    return new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
      tx.onsuccess = () => resolve();
      tx.onerror = () => resolve();
    });
  },
};
