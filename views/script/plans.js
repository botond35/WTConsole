import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let uid = null;

const __wtRun = async (user) => {
  try { await __wtMain(user); } catch (e) { console.error(e); }
};
document.addEventListener("userLoaded", ({ detail: user }) => __wtRun(user));
if (window.currentUser?.uid) __wtRun(window.currentUser);
const __wtMain = async (user) => {
  uid = user.uid;
  await loadPlans();
};

/* ── Modal ─────────────────────────────────────────── */
window.openModal = function() {
  document.getElementById("planModal").classList.remove("hidden");
  document.getElementById("planName").focus();
};

window.closeModal = function() {
  document.getElementById("planModal").classList.add("hidden");
  document.getElementById("planName").value  = "";
  document.getElementById("planDesc").value  = "";
  document.getElementById("planPrice").value = "";
  document.getElementById("planDuration").value = "";
  document.getElementById("planCategory").value = "checkup";
};

/* ── CRUD ───────────────────────────────────────────── */
async function loadPlans() {
  const container = document.getElementById("plansContainer");
  container.innerHTML = `<div class="loading-pulse">Loading plans…</div>`;

  const snap = await getDocs(
    query(collection(db, "plans"), where("userId", "==", uid))
  );

  if (snap.empty) {
    container.innerHTML = `
      <div class="col-span-3 empty-plans">
        <span class="material-symbols-rounded" style="font-size:40px;color:#d1d5db;">folder_open</span>
        <p>No service plans yet.</p>
        <p style="color:#9ca3af;font-size:13px;margin-top:4px;">Click "Add Plan" to create your first service.</p>
      </div>`;
    return;
  }

  container.innerHTML = snap.docs.map(d => {
    const p = d.data();
    return `
      <div class="plan-card">
        <div class="plan-card-top">
          <div>
            <span class="plan-category">${categoryLabel(p.category)}</span>
            <h3 class="plan-name">${p.name}</h3>
            ${p.duration ? `<span class="plan-duration">⏱ ${p.duration}</span>` : ""}
            <p class="plan-desc">${p.desc || "No description provided."}</p>
          </div>
          <button onclick="deletePlan('${d.id}')" class="plan-delete" title="Delete plan">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
        <div class="plan-price-row">
          <span class="plan-price">${p.price ? Number(p.price).toLocaleString("hu-HU") + " Ft" : "Price on request"}</span>
          <span class="plan-session">per session</span>
        </div>
      </div>`;
  }).join("");
}

window.addPlan = async function() {
  const name     = document.getElementById("planName").value.trim();
  const desc     = document.getElementById("planDesc").value.trim();
  const price    = document.getElementById("planPrice").value;
  const duration = document.getElementById("planDuration").value.trim();
  const category = document.getElementById("planCategory").value;

  if (!name) { alert("Plan name is required."); return; }

  const btn = document.getElementById("addPlanBtn");
  btn.disabled = true; btn.textContent = "Adding…";

  try {
    await addDoc(collection(db, "plans"), {
      userId: uid,
      name, desc, price: parseFloat(price) || null, duration, category
    });
    closeModal();
    await loadPlans();
  } catch (err) {
    console.error(err);
    alert("Failed to add plan.");
  } finally {
    btn.disabled = false; btn.textContent = "Add Plan";
  }
};

window.deletePlan = async function(id) {
  if (!confirm("Delete this service plan?")) return;
  try {
    await deleteDoc(doc(db, "plans", id));
    await loadPlans();
  } catch (err) {
    console.error(err);
    alert("Could not delete plan.");
  }
};

/* helpers */
function categoryLabel(c) {
  const map = {
    checkup:  "Health",
    grooming: "Grooming",
    walking:  "Walking",
    training: "Training",
    surgery:  "Surgery",
    dental:   "Dental",
    vaccine:  "Vaccination",
    other:    "Other"
  };
  return map[c] || "Other";
}
async function loadDashboard(uid) {
  const safe = async (fn, fallback = []) => {
    try { return await fn(); } catch (e) { console.error(e); return fallback; }
  };

  const [clients, bookings, invoices] = await Promise.all([
    safe(async () => (await getDocs(query(collection(db, "clients"),  where("userId",     "==", uid))))
      .docs.map(d => ({ id: d.id, ...d.data() }))),
    safe(async () => (await getDocs(query(collection(db, "bookings"), where("businessId", "==", uid))))
      .docs.map(d => ({ id: d.id, ...d.data() }))),
    safe(async () => (await getDocs(query(collection(db, "invoices"), where("userId",     "==", uid))))
      .docs.map(d => ({ id: d.id, ...d.data() }))),
  ]);

  const pendingInvoices = invoices.filter(i => i.status === "pending").length;
  const totalRevenue    = invoices
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

  setEl("statClients",  clients.length);
  setEl("statBookings", bookings.length);
  setEl("statPending",  pendingInvoices);
  setEl("statRevenue",  formatFt(totalRevenue));

  const today    = todayStr();
  const todayBk  = bookings.filter(b => b.date === today);
  const upcoming = bookings
    .filter(b => b.date && b.date > today && b.status !== "cancelled")
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") ||
                    (a.time || "").localeCompare(b.time || ""))
    .slice(0, 6);

  renderTodayBookings(todayBk);
  renderUpcomingBookings(upcoming);
  renderRecentClients(clients.slice(-5).reverse());

  revealApp();
}

function revealApp() {
  const skel = document.getElementById("skeletonScreen");
  const app  = document.getElementById("appView");
  if (skel) skel.classList.add("fade-out");
  if (app)  app.classList.add("fade-in");
  setTimeout(() => { if (skel) skel.style.display = "none"; }, 250);
}
