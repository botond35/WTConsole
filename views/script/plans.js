import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { refreshCollection } from "./dataStore.js";

let uid = null;
let allPlans = [];

// Az adatok már be vannak töltve (homepage.js), csak megjelenítjük őket.
document.addEventListener("dataReady", ({ detail }) => __wtRun(detail));
if (window.WT?.data) __wtRun(window.WT.data);

function __wtRun(data) {
  uid = data.uid;
  allPlans = data.plans || [];
  renderPlans(allPlans);
}

// Hozzáadás/törlés UTÁN hívjuk: friss adat a szerverről + cache frissítés.
async function reloadPlans() {
  allPlans = await refreshCollection("plans", uid);
  renderPlans(allPlans);
}

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

/* ── RENDER ───────────────────────────────────────────── */
function renderPlans(plans) {
  const container = document.getElementById("plansContainer");

  if (!plans.length) {
    container.innerHTML = `
      <div class="col-span-3 empty-plans">
        <span class="material-symbols-rounded" style="font-size:40px;color:#d1d5db;">folder_open</span>
        <p>No service plans yet.</p>
        <p style="color:#9ca3af;font-size:13px;margin-top:4px;">Click "Add Plan" to create your first service.</p>
      </div>`;
    return;
  }

  container.innerHTML = plans.map(p => `
      <div class="plan-card">
        <div class="plan-card-top">
          <div>
            <span class="plan-category">${categoryLabel(p.category)}</span>
            <h3 class="plan-name">${p.name}</h3>
            ${p.duration ? `<span class="plan-duration">⏱ ${p.duration}</span>` : ""}
            <p class="plan-desc">${p.desc || "No description provided."}</p>
          </div>
          <button onclick="deletePlan('${p.id}')" class="plan-delete" title="Delete plan">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
        <div class="plan-price-row">
          <span class="plan-price">${p.price ? Number(p.price).toLocaleString("hu-HU") + " Ft" : "Price on request"}</span>
          <span class="plan-session">per session</span>
        </div>
      </div>`
  ).join("");
}

/* ── CRUD ───────────────────────────────────────────── */
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
    await reloadPlans();
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
    await reloadPlans();
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
