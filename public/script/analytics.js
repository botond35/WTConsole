let revenueChart = null;
let servicesChart = null;
let bookingsChart = null;

// Az adatok már be vannak töltve (homepage.js), csak megjelenítjük őket.
document.addEventListener("dataReady", ({ detail }) => renderAnalytics(detail));
if (window.WT?.data) renderAnalytics(window.WT.data);

function renderAnalytics({ clients = [], bookings = [], invoices = [] }) {
  // ── Top KPIs ─────────────────────────────────────
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalRev = paidInvoices.reduce(
    (s, i) => s + Number(i.total || 0), 0);
  const pendingRev = invoices.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.total || 0), 0);
  const thisMonth  = new Date().toISOString().slice(0, 7);
  const monthlyRev = paidInvoices.filter(i => (i.date || "").startsWith(thisMonth)).reduce((s, i) => s + Number(i.total || 0), 0);

  setEl("kpiClients",   clients.length);
  setEl("kpiBookings",  bookings.length);
  setEl("kpiRevenue",   formatFt(totalRev));
  setEl("kpiMonthly",   formatFt(monthlyRev));
  setEl("kpiPending",   formatFt(pendingRev));
  setEl("kpiCompleted", bookings.filter(b => b.status === "completed").length);

  // ── Revenue last 6 months ─────────────────────────
  const revByMonth = getLastNMonths(6).map(m => ({
    label: m,
    value: paidInvoices.filter(i => (i.date || "").startsWith(m))
      .reduce((s, i) => s + (i.total || 0), 0)
  }));

  // ── Bookings by service ───────────────────────────
  const serviceCounts = {};
  bookings.forEach(b => {
    serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1;
  });
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // ── Bookings by month ─────────────────────────────
  const bkByMonth = getLastNMonths(6).map(m => ({
    label: m,
    value: bookings.filter(b => (b.date || "").startsWith(m)).length
  }));

  renderCharts(revByMonth, topServices, bkByMonth);
  renderServiceTable(topServices, bookings.length);
}

function renderCharts(revData, serviceData, bkData) {
  const monthLabels = revData.map(d => shortMonth(d.label));
  const revValues   = revData.map(d => d.value);
  const bkValues    = bkData.map(d => d.value);

  // Revenue chart
  const revCtx = document.getElementById("revenueChart");
  if (revCtx) {
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(revCtx, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [{
          label: "Revenue (Ft)",
          data: revValues,
          backgroundColor: "#111",
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "#f3f4f6" },
            ticks: { callback: v => v.toLocaleString("hu-HU") + " Ft", font: { size: 11 } }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Services doughnut
  const svcCtx = document.getElementById("servicesChart");
  if (svcCtx) {
    if (servicesChart) servicesChart.destroy();

    if (serviceData.length) {
      const colors = ["#111","#374151","#6b7280","#9ca3af","#d1d5db","#f3f4f6"];
      servicesChart = new Chart(svcCtx, {
        type: "doughnut",
        data: {
          labels: serviceData.map(s => s[0]),
          datasets: [{
            data: serviceData.map(s => s[1]),
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, padding: 16, font: { size: 12 } } }
          }
        }
      });
    } else {
      // Nincs adat: üres, szürke gyűrű "Nincs adat" felirattal középen,
      // hogy a chart terület sose legyen teljesen üres.
      servicesChart = new Chart(svcCtx, {
        type: "doughnut",
        data: {
          labels: ["No data"],
          datasets: [{
            data: [1],
            backgroundColor: ["#f3f4f6"],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        },
        plugins: [{
          id: "emptyCenterText",
          afterDraw(chart) {
            const { ctx, chartArea: { left, right, top, bottom } } = chart;
            ctx.save();
            ctx.font = "500 13px 'DM Sans', system-ui, sans-serif";
            ctx.fillStyle = "#9ca3af";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("No data yet", (left + right) / 2, (top + bottom) / 2);
            ctx.restore();
          }
        }]
      });
    }
  }

  // Bookings line chart
  const bkCtx = document.getElementById("bookingsChart");
  if (bkCtx) {
    if (bookingsChart) bookingsChart.destroy();
    bookingsChart = new Chart(bkCtx, {
      type: "line",
      data: {
        labels: monthLabels,
        datasets: [{
          label: "Bookings",
          data: bkValues,
          borderColor: "#111",
          backgroundColor: "rgba(17,17,17,0.06)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#111",
          pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "#f3f4f6" }, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

function renderServiceTable(services, total) {
  const el = document.getElementById("serviceTable");
  const emptyMsg = document.getElementById("noServicesMsg");

  if (!services.length) {
    if (el) el.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";
  if (!el) return;

  el.innerHTML = services.map(([name, count], i) => `
    <div class="svc-row">
      <div class="svc-rank">${i + 1}</div>
      <div class="svc-name">${name}</div>
      <div class="svc-bar-wrap">
        <div class="svc-bar" style="width:${Math.round((count / (services[0][1] || 1)) * 100)}%"></div>
      </div>
      <div class="svc-count">${count} <span>bookings</span></div>
    </div>
  `).join("");
}

/* helpers */
function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v ?? "0"; }
function formatFt(n) { return (n || 0).toLocaleString("hu-HU") + " Ft"; }
function getLastNMonths(n) {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    arr.push(d.toISOString().slice(0, 7));
  }
  return arr;
}
function shortMonth(m) {
  const [y, mo] = m.split("-");
  return new Date(y, mo - 1).toLocaleString("en-US", { month: "short" }) + " " + y.slice(2);
}