// ============================================================
//  WT Console – megosztott adat-cache (Firebase adatok)
// ------------------------------------------------------------
//  Ennek a fájlnak a lényege: a Firebase adatokat (clients,
//  bookings, invoices, plans, messages) CSAK EGYSZER töltjük le,
//  amikor a felhasználó megnyitja a programot, utána sessionStorage-ban
//  tároljuk. Amikor egy másik oldalra vált (pl. home.html -> clients.html),
//  az az oldal ebből a cache-ből olvas, nem hívja meg újra a Firebase-t,
//  ezért nincs skeleton és nincs várakozás.
//
//  A cache a böngésző FÜL bezárásáig / kijelentkezésig él
//  (sessionStorage), utána automatikusan törlődik.
// ============================================================

import { db } from "./firebase.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const CACHE_KEY = "wt_data_cache_v1";

// Minden oldalon használt Firebase collection + a mező, ami alapján
// szűrünk a bejelentkezett felhasználóra.
const COLLECTIONS = {
  clients:  { name: "clients",  field: "userId" },
  bookings: { name: "bookings", field: "businessId" },
  invoices: { name: "invoices", field: "userId" },
  plans:    { name: "plans",    field: "userId" },
  messages: { name: "messages", field: "userId" },
};

async function fetchCollection(key, uid) {
  const cfg = COLLECTIONS[key];
  const snap = await getDocs(
    query(collection(db, cfg.name), where(cfg.field, "==", uid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Letölti AZ ÖSSZES collection-t párhuzamosan (ez fut le a
 * skeleton + progress csík alatt, csak az app első megnyitásakor).
 * onProgress(0..1) hívódik minden egyes collection megérkezésekor,
 * ebből épül fel a progress csík.
 */
export async function preloadAll(uid, onProgress) {
  const keys = Object.keys(COLLECTIONS);
  const data = {};
  let done = 0;

  await Promise.all(keys.map(async (key) => {
    try {
      data[key] = await fetchCollection(key, uid);
    } catch (e) {
      console.error("WT preload error:", key, e);
      data[key] = [];
    }
    done++;
    onProgress?.(done / keys.length);
  }));

  writeRaw({ uid, data, updatedAt: Date.now() });
  return { uid, ...data };
}

/**
 * Egyetlen collection újratöltése a szerverről (pl. hozzáadás/
 * szerkesztés/törlés UTÁN hívjuk), és a cache frissítése, hogy a
 * többi oldal is a friss adatot lássa a következő megnyitáskor.
 */
export async function refreshCollection(key, uid) {
  const list = await fetchCollection(key, uid);
  const raw = readRaw() || { uid, data: {} };
  raw.uid = uid;
  raw.data = raw.data || {};
  raw.data[key] = list;
  raw.updatedAt = Date.now();
  writeRaw(raw);
  return list;
}

/** Visszaadja a cache-elt adatokat az adott userhez, ha van. */
export function getCache(uid) {
  const raw = readRaw();
  if (!raw || raw.uid !== uid || !raw.data) return null;
  return { uid, ...raw.data };
}

/** Kijelentkezéskor / felhasználóváltáskor hívjuk. */
export function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
}

function readRaw() {
  try {
    const s = sessionStorage.getItem(CACHE_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

function writeRaw(obj) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error("WT cache write failed:", e);
  }
}
