import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { refreshCollection } from "./dataStore.js";

let uid        = null;
let allInvoices = [];
let allClients  = [];
let allPlans    = [];
let lineItems   = [];
let activeFilter = "all";

// Az adatok már be vannak töltve (homepage.js), csak megjelenítjük őket.
document.addEventListener("dataReady", ({ detail }) => __wtRun(detail));
if (window.WT?.data) __wtRun(window.WT.data);

function __wtRun(data) {
  uid = data.uid;
  allInvoices = data.invoices || [];
  allClients  = data.clients  || [];
  allPlans    = data.plans    || [];

  renderInvoices(filtered());
  renderStats();
  populateClientSelect();
  populatePlanSelect();

  setupFilters();
}

/* ── Reload (CRUD után, cache-frissítéssel) ──────────── */
async function reloadInvoices() {
  allInvoices = await refreshCollection("invoices", uid);
  renderInvoices(filtered());
  renderStats();
}

function populatePlanSelect() {
  const sel = document.getElementById("inPlan");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Choose a plan to add —</option>` +
    allPlans.map(p => `<option value="${p.id}">${p.name} — ${p.price ? Number(p.price).toLocaleString("hu-HU") + " Ft" : "Price on request"}</option>`).join("");
}

window.addPlanLine = function() {
  const sel = document.getElementById("inPlan");
  const id  = sel.value;
  if (!id) return;
  const p = allPlans.find(x => x.id === id);
  if (!p) return;
  lineItems.push({ name: p.name, price: Number(p.price) || 0, qty: 1, planId: id });
  sel.value = "";
  renderLineItems();
};

function populateClientSelect() {
  const sel = document.getElementById("inClient");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Select client —</option>` +
    allClients.map(c => `<option value="${c.id}" data-pet="${c.petName}">${c.ownerName} (${c.petName})</option>`).join("");
}

/* ── Render ─────────────────────────────────────────── */
function renderInvoices(list) {
  const tbody = document.getElementById("invoiceRows");
  const empty = document.getElementById("emptyInvoices");

  if (!list.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = list
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map(inv => `
    <tr class="inv-row">
      <td class="inv-cell inv-num">${inv.invoiceNumber || "—"}</td>
      <td class="inv-cell">
        <div class="inv-client">${inv.clientName}</div>
        <div class="inv-pet"><span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;margin-right:6px;">pets</span>${inv.petName}</div>
      </td>
      <td class="inv-cell">${inv.date ? fmtDate(inv.date) : "—"}</td>
      <td class="inv-cell">${inv.dueDate ? fmtDate(inv.dueDate) : "—"}</td>
      <td class="inv-cell inv-amount">${formatFt(inv.total)}</td>
      <td class="inv-cell"><span class="badge badge-${inv.status}">${inv.status}</span></td>
      <td class="inv-cell">
        <div class="inv-actions">
          ${inv.status !== "paid" ? `<button onclick="openTerminal('${inv.id}')" class="act-btn act-pay"><span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;margin-right:6px;">credit_card</span>Pay</button>` : `<button onclick="openReceipt('${inv.id}')" class="act-btn">Receipt</button>`}
          <button onclick="deleteInvoice('${inv.id}')" class="act-btn act-del">
            <span class="material-symbols-rounded" style="font-size:16px">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderStats() {
  const paid    = allInvoices.filter(i => i.status === "paid");
  const pending = allInvoices.filter(i => i.status === "pending");
  const overdue = allInvoices.filter(i => i.status === "overdue");

  setEl("statTotalRevenue", formatFt(paid.reduce((s, i) => s + (i.total || 0), 0)));
  setEl("statPendingAmt",   formatFt(pending.reduce((s, i) => s + (i.total || 0), 0)));
  setEl("statOverdueAmt",   formatFt(overdue.reduce((s, i) => s + (i.total || 0), 0)));
  setEl("statInvoiceCount", allInvoices.length);
}

function setupFilters() {
  document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderInvoices(filtered());
    });
  });
}

function filtered() {
  if (activeFilter === "all") return allInvoices;
  return allInvoices.filter(i => i.status === activeFilter);
}

/* ── Modal ─────────────────────────────────────────── */
window.openInvoiceModal = function() {
  lineItems = [];
  document.getElementById("invoiceModal").classList.remove("hidden");
  document.getElementById("lineItems").innerHTML = "";
  document.getElementById("invoiceTotal").textContent = "0 Ft";
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("inDate").value = today;
  const due = new Date(); due.setDate(due.getDate() + 14);
  document.getElementById("inDueDate").value = due.toISOString().slice(0, 10);
};

window.closeInvoiceModal = function() {
  document.getElementById("invoiceModal").classList.add("hidden");
};

window.addLineItem = function() {
  const name  = document.getElementById("liName").value.trim();
  const price = parseFloat(document.getElementById("liPrice").value) || 0;
  const qty   = parseInt(document.getElementById("liQty").value)   || 1;
  if (!name) return;

  lineItems.push({ name, price, qty });
  document.getElementById("liName").value  = "";
  document.getElementById("liPrice").value = "";
  document.getElementById("liQty").value   = "1";
  renderLineItems();
};

function renderLineItems() {
  const el    = document.getElementById("lineItems");
  const total = lineItems.reduce((s, li) => s + li.price * li.qty, 0);
  el.innerHTML = lineItems.map((li, i) => `
    <div class="li-row">
      <span class="li-name">${li.name}</span>
      <span class="li-qty">${li.qty}×</span>
      <span class="li-price">${formatFt(li.price)}</span>
      <span class="li-sub">${formatFt(li.price * li.qty)}</span>
      <button onclick="removeLine(${i})" class="li-del">✕</button>
    </div>
  `).join("");
  document.getElementById("invoiceTotal").textContent = formatFt(total);
}

window.removeLine = function(i) {
  lineItems.splice(i, 1);
  renderLineItems();
};

window.saveInvoice = async function() {
  const clientSel  = document.getElementById("inClient");
  const clientId   = clientSel.value;
  const clientName = clientSel.options[clientSel.selectedIndex]?.text?.replace(/\s*\(.*\)/, "") || "";
  const petName    = allClients.find(c => c.id === clientId)?.petName || "";
  const status     = document.getElementById("inStatus").value;
  const date       = document.getElementById("inDate").value;
  const dueDate    = document.getElementById("inDueDate").value;
  const notes      = document.getElementById("inNotes").value.trim();

  if (!clientId)        { alert("Please select a client."); return; }
  if (!lineItems.length){ alert("Add at least one service."); return; }

  const total  = lineItems.reduce((s, li) => s + li.price * li.qty, 0);
  const invNum = "INV-" + Date.now().toString().slice(-6);

  const btn = document.getElementById("saveInvoiceBtn");
  btn.disabled = true; btn.textContent = "Saving…";

  try {
    await addDoc(collection(db, "invoices"), {
      userId: uid, invoiceNumber: invNum,
      clientId, clientName, petName, status,
      services: lineItems, total, date, dueDate, notes,
      createdAt: serverTimestamp()
    });
    closeInvoiceModal();
    await reloadInvoices();
  } catch (err) {
    console.error(err);
    alert("Failed to save invoice.");
  } finally {
    btn.disabled = false; btn.textContent = "Save Invoice";
  }
};

window.markPaid = async function(id) {
  if (!confirm("Mark this invoice as paid?")) return;
  await updateDoc(doc(db, "invoices", id), { status: "paid" });
  await reloadInvoices();
};

/* ── Pay Terminal (POS) ─────────────────────────────── */
let termInvoiceId = null;
let termMethod    = "card";

window.openTerminal = function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  termInvoiceId = id;
  termMethod    = "card";

  const overlay = document.getElementById("terminalModal");
  document.getElementById("termInvNum").textContent  = inv.invoiceNumber || "—";
  document.getElementById("termClient").textContent  = inv.clientName + (inv.petName ? " · " + inv.petName : "");
  document.getElementById("termTotal").textContent   = formatFt(inv.total);
  document.getElementById("termLines").innerHTML = (inv.services || []).map(s => `
    <div class="term-line">
      <span>${s.name} <span style="color:#9ca3af">× ${s.qty}</span></span>
      <span style="font-family:'DM Mono',monospace">${formatFt(s.price * s.qty)}</span>
    </div>
  `).join("");
  document.getElementById("termStatus").textContent = "";
  document.getElementById("termStatus").className   = "term-status";
  document.getElementById("termCharge").disabled    = false;
  document.getElementById("termCharge").textContent = "Charge " + formatFt(inv.total);
  setTermMethod("card");
  overlay.classList.remove("hidden");
};

window.closeTerminal = function() {
  document.getElementById("terminalModal").classList.add("hidden");
  termInvoiceId = null;
};

window.setTermMethod = function(m) {
  termMethod = m;
  document.querySelectorAll(".term-method").forEach(b => {
    b.classList.toggle("active", b.dataset.method === m);
  });
};

window.chargeTerminal = async function() {
  if (!termInvoiceId) return;
  const inv = allInvoices.find(i => i.id === termInvoiceId);
  if (!inv) return;

  const status = document.getElementById("termStatus");
  const btn    = document.getElementById("termCharge");
  btn.disabled = true;

  if (termMethod === "card") {
    status.className = "term-status processing";
    status.textContent = "Connecting to terminal…";
    await sleep(900);
    status.textContent = "Insert / tap card…";
    await sleep(1300);
    status.textContent = "Authorising…";
    await sleep(1100);
  } else {
    status.className = "term-status processing";
    status.textContent = "Counting cash…";
    await sleep(700);
  }

  try {
    await updateDoc(doc(db, "invoices", termInvoiceId), {
      status: "paid",
      paymentMethod: termMethod,
      paidAt: serverTimestamp()
    });
    status.className = "term-status approved";
    status.textContent = "Approved — " + formatFt(inv.total);
    btn.textContent = "Done";
    btn.disabled = false;
    btn.onclick = () => { closeTerminal(); reloadInvoices(); btn.onclick = chargeTerminal; };
  } catch (err) {
    console.error(err);
    status.className = "term-status declined";
    status.textContent = "Payment failed. Try again.";
    btn.disabled = false;
  }
};

window.openReceipt = function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  const w = window.open("", "_blank", "width=420,height=640");
  const lines = (inv.services || []).map(s =>
    `<tr><td>${s.name} × ${s.qty}</td><td style="text-align:right">${formatFt(s.price * s.qty)}</td></tr>`
  ).join("");
  w.document.write(`
    <html><head><title>Receipt ${inv.invoiceNumber}</title>
    <style>body{font-family:ui-monospace,Menlo,monospace;padding:24px;color:#111}
    h2{margin:0 0 4px}.muted{color:#777;font-size:12px}
    table{width:100%;margin-top:16px;border-collapse:collapse}
    td{padding:4px 0;border-bottom:1px dashed #ddd;font-size:13px}
    .tot{font-weight:700;font-size:16px;border-top:2px solid #111;padding-top:8px;margin-top:8px;display:flex;justify-content:space-between}
    button{margin-top:20px;padding:8px 16px;background:#111;color:#fff;border:0;border-radius:8px;cursor:pointer}</style></head>
    <body><h2>Receipt</h2><div class="muted">${inv.invoiceNumber || ""} · ${inv.date || ""}</div>
    <div style="margin-top:10px"><b>${inv.clientName}</b><br><span class="muted">${inv.petName || ""}</span></div>
    <table>${lines}</table>
    <div class="tot"><span>TOTAL</span><span>${formatFt(inv.total)}</span></div>
    <div class="muted" style="margin-top:8px">Paid · ${inv.paymentMethod || "card"}</div>
    <button onclick="window.print()">Print</button>
    </body></html>`);
  w.document.close();
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

window.deleteInvoice = async function(id) {
  if (!confirm("Delete this invoice permanently?")) return;
  await deleteDoc(doc(db, "invoices", id));
  await reloadInvoices();
};

/* helpers */
function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v ?? ""; }
function formatFt(n) { return (n || 0).toLocaleString("hu-HU") + " Ft"; }
function fmtDate(s) { return new Date(s + "T00:00").toLocaleDateString("hu-HU"); }
