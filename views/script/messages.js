import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { refreshCollection } from "./dataStore.js";

let uid     = null;
let allMsgs = [];
let selected = null;

// Az adatok már be vannak töltve (homepage.js), csak megjelenítjük őket.
document.addEventListener("dataReady", ({ detail }) => __wtRun(detail));
if (window.WT?.data) __wtRun(window.WT.data);

function __wtRun(data) {
  uid = data.uid;
  allMsgs = sortMsgs(data.messages || []);
  renderList();
  updateUnreadBadge();
}

function sortMsgs(list) {
  return [...list].sort((a, b) => {
    const ta = a.createdAt?.toDate?.() || new Date(0);
    const tb = b.createdAt?.toDate?.() || new Date(0);
    return tb - ta;
  });
}

// Törlés/új jegyzet UTÁN hívjuk: friss adat a szerverről + cache frissítés.
async function reloadMessages() {
  allMsgs = sortMsgs(await refreshCollection("messages", uid));
  renderList();
  updateUnreadBadge();
}

function renderList() {
  const el = document.getElementById("msgList");
  if (!allMsgs.length) {
    el.innerHTML = `<div class="msg-empty">No messages yet. Booking requests will appear here.</div>`;
    return;
  }
  el.innerHTML = allMsgs.map(m => `
    <div class="msg-item ${m.read ? "" : "unread"} ${selected?.id === m.id ? "active" : ""}"
         onclick="selectMsg('${m.id}')">
      <div class="msg-icon">${typeIcon(m.type)}</div>
      <div class="msg-preview">
        <div class="msg-from">${m.from || m.title}</div>
        <div class="msg-subject">${m.subject || m.title}</div>
        <div class="msg-snippet">${(m.body || "").slice(0, 60)}…</div>
      </div>
      <div class="msg-meta">
        <div class="msg-time">${fmtTime(m.createdAt)}</div>
        ${!m.read ? '<div class="unread-dot"></div>' : ""}
      </div>
    </div>
  `).join("");
}

window.selectMsg = async function(id) {
  selected = allMsgs.find(m => m.id === id);
  if (!selected) return;

  // Mark as read
  if (!selected.read) {
    await updateDoc(doc(db, "messages", id), { read: true });
    selected.read = true;
    updateUnreadBadge();
  }

  renderList();
  renderDetail();
};

function renderDetail() {
  const pane = document.getElementById("msgDetail");
  if (!selected) {
    pane.innerHTML = `<div class="detail-empty">Select a message to read it</div>`;
    return;
  }

  const m = selected;
  pane.innerHTML = `
    <div class="detail-header">
      <div class="detail-icon">${typeIcon(m.type)}</div>
      <div>
        <div class="detail-title">${m.title || m.subject}</div>
        <div class="detail-meta">${fmtTime(m.createdAt)} · ${typeLabel(m.type)}</div>
      </div>
      <button onclick="deleteMsg('${m.id}')" class="detail-del" title="Delete">
        <span class="material-symbols-rounded">delete</span>
      </button>
    </div>
    <div class="detail-body">${m.body || ""}</div>
    ${m.type === "booking" ? renderBookingCard(m) : ""}
  `;
}

function renderBookingCard(m) {
  if (!m.bookingData) return "";
  const b = m.bookingData;
  return `
    <div class="booking-card-detail">
      <div class="bcd-title"><span class="material-symbols-rounded" style="font-size:18px;vertical-align:middle;margin-right:6px;">list_alt</span>Booking Details</div>
      <div class="bcd-grid">
        <div><span>Owner</span><strong>${b.ownerName}</strong></div>
        <div><span>Pet</span><strong>${b.petName}</strong></div>
        <div><span>Breed</span><strong>${b.breed || "—"}</strong></div>
        <div><span>Service</span><strong>${b.service}</strong></div>
        <div><span>Date</span><strong>${b.date}</strong></div>
        <div><span>Time</span><strong>${b.time}</strong></div>
        <div><span>Phone</span><strong>${b.phone}</strong></div>
        <div><span>Email</span><strong>${b.email}</strong></div>
        ${b.notes ? `<div class="bcd-notes"><span>Notes</span><strong>${b.notes}</strong></div>` : ""}
      </div>
      <div class="bcd-actions">
        <button onclick="updateBookingStatus('${m.bookingId}','confirmed')" class="bcd-btn bcd-confirm">✓ Confirm</button>
        <button onclick="updateBookingStatus('${m.bookingId}','cancelled')" class="bcd-btn bcd-cancel">✕ Cancel</button>
      </div>
    </div>`;
}

window.updateBookingStatus = async function(bookingId, status) {
  if (!bookingId) return;
  try {
    await updateDoc(doc(db, "bookings", bookingId), { status });
    if (selected?.bookingData) selected.bookingData.status = status;
    renderDetail();
    alert(`Booking ${status}.`);
  } catch (err) {
    console.error(err);
  }
};

window.deleteMsg = async function(id) {
  if (!confirm("Delete this message?")) return;
  await deleteDoc(doc(db, "messages", id));
  selected = null;
  renderDetail();
  await reloadMessages();
};

/* ── Compose Note ─────────────────────────────────── */
window.openNoteModal = function() {
  document.getElementById("noteModal").classList.remove("hidden");
};

window.closeNoteModal = function() {
  document.getElementById("noteModal").classList.add("hidden");
  document.getElementById("noteTitle").value = "";
  document.getElementById("noteBody").value  = "";
};

window.saveNote = async function() {
  const title = document.getElementById("noteTitle").value.trim();
  const body  = document.getElementById("noteBody").value.trim();
  if (!title || !body) { alert("Fill in both fields."); return; }

  const btn = document.getElementById("saveNoteBtn");
  btn.disabled = true; btn.textContent = "Saving…";

  try {
    await addDoc(collection(db, "messages"), {
      userId: uid,
      type: "note",
      title,
      subject: title,
      from: "You (note)",
      body,
      read: true,
      createdAt: serverTimestamp()
    });
    closeNoteModal();
    await reloadMessages();
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Save Note";
  }
};

function updateUnreadBadge() {
  const count = allMsgs.filter(m => !m.read).length;
  const el = document.getElementById("unreadCount");
  if (el) el.textContent = count || "";
  el.style.display = count ? "flex" : "none";
}

/* helpers */
function fmtTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("hu-HU") + " " + d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
}
function typeIcon(t) {
  return ({
    booking: "event",
    note: "edit_note",
    alert: "warning",
    chat: "chat"
  }[t] || "message");
}
function typeLabel(t) { return ({ booking: "Booking Request", note: "Note", alert: "Alert" }[t] || "Message"); }
