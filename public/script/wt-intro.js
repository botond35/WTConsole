/* ─────────────────────────────────────────────────────────────
   WT guided tour (intro.js)
   • Starts automatically the first time a user opens a page.
   • Can always be replayed from the floating "?" help button
     or by appending ?tour=1 to the URL.
   ───────────────────────────────────────────────────────────── */
(function () {
  var INTRO_CSS = "https://unpkg.com/intro.js@7.2.0/minified/introjs.min.css";
  var INTRO_JS = "https://unpkg.com/intro.js@7.2.0/minified/intro.min.js";

  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ── Step definitions per page ───────────────────────────── */
  var TOURS = {
    "home.html": [
      { el: "aside nav", title: "Navigation", text: "Everything lives here: clients, bookings, plans, invoices, messages, analytics and settings." },
      { el: 'aside nav a[href="plans.html"]', title: "Service plans", text: "Create the services you offer. They show up on your public booking page automatically." },
      { el: 'aside nav a[href="bookings.html"]', title: "Bookings", text: "Every appointment your clients book lands here." },
      { el: 'aside nav a[href="settings.html"]', title: "Settings & your page address", text: "Claim your walktogether.com address and build your website from here." }
    ],
    "plans.html": [
      { el: "#plansContainer", title: "Your services", text: "Each card is one service. Cards look exactly the same here, on your public booking page and inside the website editor." },
      { el: 'button[onclick="openModal()"]', title: "Add a plan", text: "Add a name, category, price and duration — clients can book it right away." },
      { el: ".bg-blue-50", title: "Public booking page", text: "Open your booking page to see what your clients see." }
    ],
    "settings.html": [
      { el: "#domainQuery", title: "Your page address", text: "Pick a type and a name — this is the address your website will live on." },
      { el: "#domainResults", title: "Check & claim", text: "Available addresses can be claimed with one click." },
      { el: "#wtPageLinkCard", title: "Connected website", text: "Your claimed address is linked to the page you build in the editor. Jump straight into the editor from here." },
      { el: "#darkToggle", title: "Dark mode", text: "Flip the whole console to a dark theme — every page follows." }
    ],
    "creat.html": [
      { el: "body", title: "Pick a template", text: "Choose the template that matches your business. You can change it later at any time." }
    ],
    "editor.html": [
      { el: "#blockList", title: "Blocks", text: "Show, hide and reorder the sections of your website." },
      { el: "#swatchRow", title: "Colours & fonts", text: "Set the accent colour and the base font. Select any text for per-text styling." },
      { el: ".device-switch", title: "Device preview", text: "Preview your page at real iPhone and iPad sizes — the content scrolls inside the device just like on a real one." },
      { el: "#wtDomainChip", title: "Your address", text: "This is the walktogether.com address claimed in Settings. Publishing puts this page there." },
      { el: "#publishBtn", title: "Publish", text: "One click and your page goes live on your claimed address." }
    ],
    "clients.html": [
      { el: "body", title: "Clients", text: "All of your clients and their pets. Add, search and open a profile to see their history." }
    ],
    "bookings.html": [
      { el: "body", title: "Bookings", text: "Incoming appointments. Confirm, reschedule or cancel them from here." }
    ],
    "invoices.html": [
      { el: "body", title: "Invoices", text: "Create and track invoices for completed services." }
    ]
  };

  function doneKey() { return "wt_tour_done_" + page; }

  function loadCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }

  function loadJs(src, cb) {
    if (window.introJs) { cb(); return; }
    var s = document.createElement("script");
    s.src = src;
    s.onload = cb;
    s.onerror = function () { /* offline: silently skip the tour */ };
    document.head.appendChild(s);
  }

  function buildSteps() {
    var defs = TOURS[page] || [];
    var steps = [];
    defs.forEach(function (d) {
      var el = d.el === "body" ? document.body : document.querySelector(d.el);
      if (!el) return;
      steps.push({ element: el, title: d.title, intro: d.text });
    });
    return steps;
  }

  function start(force) {
    var steps = buildSteps();
    if (!steps.length) return;
    loadCss(INTRO_CSS);
    loadJs(INTRO_JS, function () {
      if (!window.introJs) return;
      var tour = window.introJs();
      tour.setOptions({
        steps: steps,
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: false,
        scrollToElement: true,
        nextLabel: "Next",
        prevLabel: "Back",
        doneLabel: "Got it"
      });
      tour.oncomplete(function () { localStorage.setItem(doneKey(), "1"); });
      tour.onexit(function () { localStorage.setItem(doneKey(), "1"); });
      tour.start();
      if (force) localStorage.setItem(doneKey(), "1");
    });
  }

  function addHelpButton() {
    if (document.getElementById("wtTourBtn")) return;
    if (!(TOURS[page] || []).length) return;
    var style = document.createElement("style");
    style.textContent =
      "#wtTourBtn{position:fixed;right:18px;bottom:18px;z-index:9998;width:40px;height:40px;border-radius:50%;" +
      "border:1px solid rgba(0,0,0,.08);background:#111;color:#fff;font-size:18px;font-weight:600;cursor:pointer;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;}" +
      "#wtTourBtn:hover{transform:translateY(-1px);}" +
      'html[data-theme="dark"] #wtTourBtn{background:#f3f4f6;color:#0d0d10;border-color:#2a2a31;}';
    document.head.appendChild(style);

    var b = document.createElement("button");
    b.id = "wtTourBtn";
    b.type = "button";
    b.title = "Show me around";
    b.textContent = "?";
    b.addEventListener("click", function () { start(true); });
    document.body.appendChild(b);
  }

  window.wtStartTour = function () { start(true); };

  function init() {
    addHelpButton();
    var forced = /[?&]tour=1/.test(location.search);
    if (forced || !localStorage.getItem(doneKey())) {
      // let the page render / data load first
      setTimeout(function () { start(forced); }, forced ? 200 : 1200);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
