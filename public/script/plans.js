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

/* ── Category → icon + color (mirrors booking.js's categoryIcon,
   so a service looks the same here and on the public booking page) ── */
const CATEGORY_META = {
  checkup:  { label:"Health",     icon:"medical_services", color:"#2F6FE4", bg:"#EAF3FF" },
  vaccine:  { label:"Vaccination",icon:"vaccines",         color:"#2F9E52", bg:"#EAF7EE" },
  dental:   { label:"Dental",     icon:"dental_services",  color:"#D6499E", bg:"#FDF0F8" },
  grooming: { label:"Grooming",   icon:"content_cut",      color:"#D8493D", bg:"#FFF1F0" },
  walking:  { label:"Walking",    icon:"directions_walk",  color:"#10A398", bg:"#EFFCFB" },
  training: { label:"Training",   icon:"school",           color:"#C98A12", bg:"#FFF7E6" },
  surgery:  { label:"Surgery",    icon:"local_hospital",   color:"#7C5CFC", bg:"#F3EEFF" },
  other:    { label:"Other",      icon:"list_alt",         color:"#6B7280", bg:"#F3F4F6" },
};
function categoryMeta(c){ return CATEGORY_META[c] || CATEGORY_META.other; }

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

  container.innerHTML = plans.map(p => {
    const meta = categoryMeta(p.category);
    return `
      <div class="plan-card">
        <div class="plan-card-top">
          <div class="plan-card-left">
            <div class="plan-icon-chip" style="background:${meta.bg};color:${meta.color};">
              <span class="material-symbols-rounded">${meta.icon}</span>
            </div>
            <div class="plan-card-main">
              <span class="plan-category">${meta.label}</span>
              <h3 class="plan-name">${esc(p.name)}</h3>
              ${p.duration ? `<span class="plan-duration"><span class="material-symbols-rounded">schedule</span>${esc(p.duration)}</span>` : ""}
              <p class="plan-desc">${esc(p.desc) || "No description provided."}</p>
              ${p.desc ? `<button class="plan-info-btn" type="button" data-plan-info="${p.id}">
                <span class="material-symbols-rounded">info</span>Full description
              </button>` : ""}
            </div>
          </div>
          <button onclick="deletePlan('${p.id}')" class="plan-delete" title="Delete plan">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
        <div class="plan-price-row">
          <span class="plan-price">${p.price ? Number(p.price).toLocaleString("hu-HU") + " Ft" : "Price on request"}</span>
          <span class="plan-session">per session</span>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll("[data-plan-info]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const plan = plans.find(pl => pl.id === btn.dataset.planInfo);
      if (plan) togglePlanDescPopover(btn, plan);
    });
  });
}

/* ── Full-description popover ─────────────────────────── */
function togglePlanDescPopover(anchorEl, plan) {
  const pop = document.getElementById("planDescPopover");
  if (pop.classList.contains("show") && pop.dataset.for === plan.id) {
    hidePlanDescPopover();
    return;
  }
  document.getElementById("planDescPopoverTitle").textContent = plan.name || "";
  document.getElementById("planDescPopoverText").textContent = plan.desc || "";
  pop.dataset.for = plan.id;
  pop.classList.add("show");
  positionPlanDescPopover(anchorEl);
}
function positionPlanDescPopover(anchorEl) {
  const pop = document.getElementById("planDescPopover");
  const r = anchorEl.getBoundingClientRect();
  const pw = pop.offsetWidth || 260;
  let left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
  let top = r.bottom + 8;
  if (top + 90 > window.innerHeight) top = r.top - pop.offsetHeight - 8;
  pop.style.left = left + "px";
  pop.style.top = Math.max(8, top) + "px";
}
function hidePlanDescPopover() {
  const pop = document.getElementById("planDescPopover");
  pop.classList.remove("show");
  delete pop.dataset.for;
}
document.addEventListener("click", (e) => {
  const pop = document.getElementById("planDescPopover");
  if (!pop || !pop.classList.contains("show")) return;
  if (pop.contains(e.target)) return;
  hidePlanDescPopover();
});
window.addEventListener("resize", hidePlanDescPopover);
window.addEventListener("scroll", hidePlanDescPopover, true);

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
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }