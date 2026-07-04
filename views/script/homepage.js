import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value ?? "";
}

/* ── Theme (dark mode) ──────────────────────────────
   Applied as early as possible to avoid flash and on every page. */
function applyTheme() {
  const dark = localStorage.getItem("darkMode") === "true";
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}
applyTheme();

// Inject global dark-mode overrides once, so Tailwind-coloured pages
// (home, clients, plans, invoices, messages, analytics, settings) all flip.
(function injectDarkStyles() {
  if (document.getElementById("wt-dark-style")) return;
  const css = `
    html[data-theme="dark"] { color-scheme: dark; }
    html[data-theme="dark"] body,
    html[data-theme="dark"] .bg-gray-50,
    html[data-theme="dark"] .bg-gray-100 { background-color:#0b0b0d !important; color:#e5e7eb !important; }
    html[data-theme="dark"] .bg-white,
    html[data-theme="dark"] aside,
    html[data-theme="dark"] .card,
    html[data-theme="dark"] main { background-color:#141418 !important; color:#e5e7eb !important; }
    html[data-theme="dark"] .border-gray-100,
    html[data-theme="dark"] .border-gray-200 { border-color:#26262c !important; }
    html[data-theme="dark"] .text-gray-900 { color:#f3f4f6 !important; }
    html[data-theme="dark"] .text-gray-700,
    html[data-theme="dark"] .text-gray-600 { color:#d1d5db !important; }
    html[data-theme="dark"] .text-gray-500,
    html[data-theme="dark"] .text-gray-400 { color:#9ca3af !important; }
    html[data-theme="dark"] .shadow,
    html[data-theme="dark"] .shadow-sm { box-shadow:0 1px 2px rgba(0,0,0,.6) !important; }
    html[data-theme="dark"] input,
    html[data-theme="dark"] select,
    html[data-theme="dark"] textarea { background-color:#1c1c22 !important; color:#e5e7eb !important; border-color:#2b2b33 !important; }
    html[data-theme="dark"] a.bg-black,
    html[data-theme="dark"] .bg-black { background-color:#e5e7eb !important; color:#0b0b0d !important; }
  `;
  const style = document.createElement("style");
  style.id = "wt-dark-style";
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
})();

/* Sticky userLoaded: cache the user on window so listeners attached AFTER
   onAuthStateChanged fires still get a chance to react. */
window.whenUserLoaded = function (cb) {
  if (window.currentUser?.uid) { cb(window.currentUser); return; }
  document.addEventListener("userLoaded", (e) => cb(e.detail), { once: true });
};


onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const d = snap.exists() ? snap.data() : {
      firstName: (user.displayName || "").split(" ")[0] || "",
      lastName:  (user.displayName || "").split(" ").slice(1).join(" ") || "",
      email:     user.email || "",
      Business:  "",
      Phone:     ""
    };

    const firstName = d.firstName || "";
    const lastName  = d.lastName  || "";
    const full      = `${firstName} ${lastName}`.trim();
    const initials  = ((firstName[0] || "") + (lastName[0] || "")).toUpperCase();

    setEl("loggedUserFName",  firstName);
    setEl("loggedUserLName",  lastName);
    setEl("loggedUserEmail",  d.email || user.email);
    setEl("loggedBusiness",   d.Business || "");
    setEl("loggedPhone",      d.Phone    || "");
    setEl("fullName",         full);
    setEl("loggedUserType",   "Administrator");
    setEl("avatarInitials",   initials);
    setEl("sidebarName",      full);
    setEl("sidebarAvatar",    initials);

    window.currentUser = { ...d, uid: user.uid, email: d.email || user.email };
    document.dispatchEvent(new CustomEvent("userLoaded", { detail: window.currentUser }));
    // Re-dispatch shortly after to catch listeners that mount via late-running modules.
    setTimeout(() => document.dispatchEvent(new CustomEvent("userLoaded", { detail: window.currentUser })), 50);
  } catch (err) {
    console.error("User load error:", err);
  }
});

window.revealApp = function () {
  const skel = document.getElementById("skeletonScreen");
  const app  = document.getElementById("appView");
  if (skel) skel.classList.add("fade-out");
  if (app)  app.classList.add("fade-in");
  setTimeout(() => { if (skel) skel.style.display = "none"; }, 250);
};

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("logout");
  if (btn) {
    btn.addEventListener("click", async () => {
      await signOut(auth);
      localStorage.removeItem("loggedInUserId");
      window.location.href = "index.html";
    });
  }
});
