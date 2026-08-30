/* ---------------------------
   Dashboard – az adatokat már a homepage.js tölti be (1x, az app
   megnyitásakor), ez a script csak MEGJELENÍTI azokat. Nincs saját
   Firebase hívás, ezért oldalváltáskor azonnal renderel.
---------------------------- */

/* ---------------------------
   GREETING (a bejelentkezett user profiljából, "userLoaded" esemény)
---------------------------- */

document.addEventListener("userLoaded", ({ detail: user }) => setGreeting(user));
if (window.currentUser?.uid) setGreeting(window.currentUser);

function setGreeting(user) {
  const hour = new Date().getHours();

  const greet =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    "Good evening";

  setEl("greeting", `${greet}, ${user.firstName || "there"}!`);

  const dateEl = document.getElementById("dateDisplay");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
}

/* ---------------------------
   DASHBOARD RENDER (a cache-elt adatokból, "dataReady" esemény)
---------------------------- */

document.addEventListener("dataReady", ({ detail }) => renderDashboard(detail));
if (window.WT?.data) renderDashboard(window.WT.data);

function renderDashboard({ clients = [], bookings = [], invoices = [] }) {
  const pendingInvoices = invoices.filter(i => i.status === "pending").length;

  const totalRevenue = invoices
    .filter(i => i.status === "paid")
    .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

  setEl("statClients", clients.length);
  setEl("statBookings", bookings.length);
  setEl("statPending", pendingInvoices);
  setEl("statRevenue", formatFt(totalRevenue));

  const today = todayStr();

  const todayBk = bookings.filter(b => b.date === today);

  const upcoming = bookings
    .filter(b => b.date && b.date > today && b.status !== "cancelled")
    .sort((a, b) =>
      (a.date || "").localeCompare(b.date || "") ||
      (a.time || "").localeCompare(b.time || "")
    )
    .slice(0, 6);

  renderTodayBookings(todayBk);
  renderUpcomingBookings(upcoming);
  renderRecentClients(clients.slice(-5).reverse());
}

/* ---------------------------
   RENDER: TODAY
---------------------------- */

function renderTodayBookings(list) {
  const el = document.getElementById("todayBookings");
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div class="empty-msg">No appointments scheduled for today</div>`;
    return;
  }

  el.innerHTML = list
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
    .map(b => `
      <div class="appt-row">
        <div class="appt-time">${b.time || "—"}</div>
        <div class="appt-body">
          <div class="appt-name">${b.ownerName}</div>
          <div class="appt-sub">
            <span class="material-symbols-rounded">pets</span>
            ${b.petName} · ${b.service}
          </div>
        </div>
        <span class="badge badge-${b.status}">${b.status}</span>
      </div>
    `).join("");
}

/* ---------------------------
   RENDER: UPCOMING
---------------------------- */

function renderUpcomingBookings(list) {
  const el = document.getElementById("upcomingBookings");
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div class="empty-msg">No upcoming appointments this week</div>`;
    return;
  }

  el.innerHTML = list.map(b => `
    <div class="appt-row">
      <div class="appt-date-tag">${fmtDate(b.date)}</div>
      <div class="appt-body">
        <div class="appt-name">${b.ownerName}</div>
        <div class="appt-sub">
          <span class="material-symbols-rounded">pets</span>
          ${b.petName} · ${b.service}
        </div>
      </div>
      <span class="badge badge-${b.status}">${b.status}</span>
    </div>
  `).join("");
}

/* ---------------------------
   RENDER: CLIENTS
---------------------------- */

function renderRecentClients(list) {
  const el = document.getElementById("recentClients");
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-msg">
        No clients yet. <a href="clients.html">Add your first →</a>
      </div>`;
    return;
  }

  el.innerHTML = list.map(c => `
    <div class="client-row">
      <div class="client-avatar-sm">${initials(c.ownerName)}</div>
      <div>
        <div class="client-name">${c.ownerName}</div>
        <div class="client-pet">
          ${speciesEmoji(c.species)} ${c.petName} · ${c.breed || "Mixed"}
        </div>
      </div>
    </div>
  `).join("");
}

/* ---------------------------
   HELPERS
---------------------------- */

function setEl(id, v) {
  const e = document.getElementById(id);
  if (e) e.textContent = v ?? "";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(s) {
  return new Date(s + "T00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function formatFt(n) {
  return (n || 0).toLocaleString("hu-HU") + " Ft";
}

function initials(n) {
  return (n || "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function speciesEmoji(s) {
  return ({ dog: "Dog", cat: "Cat", bird: "Bird", rabbit: "Rabbit" }[s] || "Other");
}
