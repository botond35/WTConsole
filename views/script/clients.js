import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { refreshCollection } from "./dataStore.js";

let uid      = null;
let allClients = [];

// Az adatok már be vannak töltve (homepage.js), csak megjelenítjük őket.
document.addEventListener("dataReady", ({ detail }) => __wtRun(detail));
if (window.WT?.data) __wtRun(window.WT.data);

function __wtRun(data) {
  uid = data.uid;
  allClients = data.clients || [];
  renderClients(allClients);
  document.getElementById("clientCount").textContent = allClients.length;
  setupSearch();
}

// Hozzáadás/szerkesztés/törlés UTÁN hívjuk: friss adat a szerverről + cache frissítés.
async function reloadClients() {
  allClients = await refreshCollection("clients", uid);
  renderClients(allClients);
  document.getElementById("clientCount").textContent = allClients.length;
}

function renderClients(list) {
  const grid = document.getElementById("clientsGrid");
  const empty = document.getElementById("emptyState");

  if (!list.length) {
    grid.innerHTML  = "";
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  grid.innerHTML = list.map(c => `
    <div class="client-card" data-id="${c.id}">
      <div class="cc-header">
        <div class="cc-avatar">${initials(c.ownerName)}</div>
        <div class="cc-actions">
          <button class="cc-btn" onclick="openEdit('${c.id}')" title="Edit">
            <span class="material-symbols-rounded" style="font-size:18px">edit</span>
          </button>
          <button class="cc-btn cc-btn-danger" onclick="deleteClient('${c.id}')" title="Delete">
            <span class="material-symbols-rounded" style="font-size:18px">delete</span>
          </button>
        </div>
      </div>
      <div class="cc-owner">${c.ownerName}</div>
      <div class="cc-contact">${c.ownerEmail || ""}</div>
      <div class="cc-contact">${c.phone || ""}</div>
      <div class="cc-divider"></div>
      <div class="cc-pet">
        <span class="cc-pet-icon"><span class="material-symbols-rounded">pets</span></span>
        <div>
          <div class="cc-pet-name">${c.petName}</div>
          <div class="cc-pet-detail">${c.breed || "Mixed"} · ${c.age ? c.age + " yrs" : "—"} · ${c.weight ? c.weight + " kg" : "—"}</div>
        </div>
      </div>
      ${c.medicalNotes ? `<div class="cc-notes">${c.medicalNotes}</div>` : ""}
    </div>
  `).join("");
}

function setupSearch() {
  document.getElementById("searchInput").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    renderClients(
      allClients.filter(c =>
        c.ownerName.toLowerCase().includes(q) ||
        (c.petName   || "").toLowerCase().includes(q) ||
        (c.breed     || "").toLowerCase().includes(q) ||
        (c.ownerEmail|| "").toLowerCase().includes(q)
      )
    );
  });
}

/* ── Modal ─────────────────────────────────────────── */
let editId = null;

window.openAdd = function() {
  editId = null;
  document.getElementById("modalTitle").textContent = "Add Client";
  // Manually clear all fields (modal has no <form> wrapper)
  ["inOwnerName","inOwnerEmail","inPhone","inAddress","inPetName",
   "inBreed","inAge","inWeight","inVaccinations","inMedicalNotes"
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const sp = document.getElementById("inSpecies"); if (sp) sp.value = "dog";
  document.getElementById("clientModal").classList.remove("hidden");
};

window.openEdit = function(id) {
  const c = allClients.find(x => x.id === id);
  if (!c) return;
  editId = id;
  document.getElementById("modalTitle").textContent = "Edit Client";
  const f = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ""; };
  f("inOwnerName",  c.ownerName);
  f("inOwnerEmail", c.ownerEmail);
  f("inPhone",      c.phone);
  f("inAddress",    c.address);
  f("inPetName",    c.petName);
  f("inSpecies",    c.species);
  f("inBreed",      c.breed);
  f("inAge",        c.age);
  f("inWeight",     c.weight);
  f("inVaccinations", c.vaccinations);
  f("inMedicalNotes", c.medicalNotes);
  document.getElementById("clientModal").classList.remove("hidden");
};

window.closeClientModal = function() {
  document.getElementById("clientModal").classList.add("hidden");
};

window.saveClient = async function() {
  const g = id => document.getElementById(id)?.value.trim() || "";
  const ownerName = g("inOwnerName");
  const petName   = g("inPetName");

  if (!ownerName || !petName) {
    alert("Owner name and pet name are required.");
    return;
  }

  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const data = {
    userId:       uid,
    ownerName,
    ownerEmail:   g("inOwnerEmail"),
    phone:        g("inPhone"),
    address:      g("inAddress"),
    petName,
    species:      g("inSpecies")    || "dog",
    breed:        g("inBreed"),
    age:          parseFloat(g("inAge"))    || null,
    weight:       parseFloat(g("inWeight")) || null,
    vaccinations: g("inVaccinations"),
    medicalNotes: g("inMedicalNotes"),
    createdAt:    editId ? undefined : serverTimestamp()
  };

  try {
    if (editId) {
      const clean = Object.fromEntries(Object.entries(data).filter(([,v]) => v !== undefined));
      await updateDoc(doc(db, "clients", editId), clean);
    } else {
      await addDoc(collection(db, "clients"), data);
    }
    closeClientModal();
    await reloadClients();
  } catch (err) {
    console.error(err);
    alert("Failed to save. Check console.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
};

window.deleteClient = async function(id) {
  if (!confirm("Delete this client? This action cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "clients", id));
    await reloadClients();
  } catch (err) {
    console.error(err);
    alert("Could not delete client.");
  }
};

/* helpers */
function initials(n) { return (n || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); }