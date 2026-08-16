import { db } from "./firebase.js";
import {
  collection, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { refreshCollection } from "./dataStore.js";

let uid = null;
let allBookings = [];
let activeFilter = "all";

// Az adatok már be vannak töltve (homepage.js), csak megjelenítjük őket.
document.addEventListener("dataReady", ({ detail }) => __wtRun(detail));
if (window.WT?.data) __wtRun(window.WT.data);

function __wtRun(data) {
  uid = data.uid;
  allBookings = sortBookings(data.bookings || []);
  render();
  setupFilters();
  setupSearch();
}

function sortBookings(list) {
  return [...list].sort((a, b) =>
    ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || ""))
  );
}

// Törlés/frissítés esetén (pl. ha külső oldalon módosult) friss adat + cache.
async function reloadBookings() {
  allBookings = sortBookings(await refreshCollection("bookings", uid));
  render();
}

function setupFilters() {
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      render();
    });
  });
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  if (input) input.addEventListener("input", render);
}

function currentList() {
  const term = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowTime = now.toTimeString().slice(0, 5); // "HH:MM"

  return allBookings.filter(b => {
    if (activeFilter === "today")    { if (b.date !== today) return false; }
    if (activeFilter === "upcoming") {
      if (b.status === "cancelled") return false;
      const isFutureDate = b.date > today;
      const isTodayNotPassed = b.date === today && (b.time || "") >= nowTime;
      if (!isFutureDate && !isTodayNotPassed) return false;
    }
    if (activeFilter === "past")     { if (!(b.date < today)) return false; }
    if (activeFilter === "pending")  { if (b.status !== "pending") return false; }
    if (term) {
      const hay = [b.ownerName, b.petName, b.service, b.phone, b.email, b.notes].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function render() {
  const list = currentList();
  document.getElementById("bookingCount").textContent = list.length;

  // Stats
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("statTotal").textContent    = allBookings.length;
  document.getElementById("statToday").textContent    = allBookings.filter(b => b.date === today).length;
  document.getElementById("statUpcoming").textContent = allBookings.filter(b => {
    if (b.status === "cancelled") return false;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowTime = now.toTimeString().slice(0, 5);
    return b.date > today || (b.date === today && (b.time || "") >= nowTime);
  }).length;
  document.getElementById("statPending").textContent  = allBookings.filter(b => b.status === "pending").length;

  const grid  = document.getElementById("bookingsGrid");
  const empty = document.getElementById("emptyState");
  if (!list.length) {
    grid.innerHTML = "";
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  grid.innerHTML = list.map(b => `
    <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="font-semibold text-gray-900 text-base">${esc(b.ownerName) || "—"}</div>
          <div class="text-sm text-gray-500 mt-0.5"><span class="material-symbols-rounded text-[16px] text-gray-400" style="vertical-align:middle;margin-right:6px;">pets</span>${esc(b.petName) || "—"}${b.breed ? " · " + esc(b.breed) : ""}</div>
        </div>
        <span class="status-badge status-${b.status || "pending"}">${b.status || "pending"}</span>
      </div>

      <div class="space-y-1.5 text-sm text-gray-600 mb-4">
        <div class="flex items-center gap-2"><span class="material-symbols-rounded text-[16px] text-gray-400">event</span>${fmtDate(b.date)} · ${esc(b.time) || "—"}</div>
        <div class="flex items-center gap-2"><span class="material-symbols-rounded text-[16px] text-gray-400">medical_services</span>${esc(b.service) || "—"}${b.price ? ` · ${Number(b.price).toLocaleString("hu-HU")} Ft` : ""}</div>
        ${b.phone ? `<div class="flex items-center gap-2"><span class="material-symbols-rounded text-[16px] text-gray-400">call</span>${esc(b.phone)}</div>` : ""}
        ${b.email ? `<div class="flex items-center gap-2"><span class="material-symbols-rounded text-[16px] text-gray-400">mail</span>${esc(b.email)}</div>` : ""}
        ${b.notes ? `<div class="flex items-start gap-2"><span class="material-symbols-rounded text-[16px] text-gray-400 mt-0.5">sticky_note_2</span><span>${esc(b.notes)}</span></div>` : ""}
      </div>

      <div class="flex gap-2 pt-3 border-t border-gray-100">
        ${b.status !== "confirmed" ? `<button onclick="setStatus('${b.id}','confirmed')" class="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition">Confirm</button>` : ""}
        ${b.status !== "cancelled" ? `<button onclick="setStatus('${b.id}','cancelled')" class="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition">Cancel</button>` : ""}
        ${b.status !== "completed" ? `<button onclick="setStatus('${b.id}','completed')" class="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition">Done</button>` : ""}
        <button onclick="deleteBooking('${b.id}')" class="text-xs font-medium px-3 py-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition" title="Delete"><span class="material-symbols-rounded text-[16px]">delete</span></button>
      </div>
    </div>
  `).join("");
}

window.setStatus = async (id, status) => {
  try {
    await updateDoc(doc(db, "bookings", id), { status });
    const b = allBookings.find(x => x.id === id);
    if (b) b.status = status;
    render();
  } catch (e) { console.error(e); alert("Could not update booking."); }
};

window.deleteBooking = async (id) => {
  if (!confirm("Delete this booking? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "bookings", id));
    allBookings = allBookings.filter(b => b.id !== id);
    render();
  } catch (e) { console.error(e); alert("Could not delete booking."); }
};

/* helpers */
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function fmtDate(s) { if (!s) return "—"; return new Date(s + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
