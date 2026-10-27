import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { preloadAll, getCache, clearCache } from "./dataStore.js";
import { loadingTips } from "./loadingTips.js";

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value ?? "";
}
/* Sticky userLoaded: cache the user on window so listeners attached AFTER
   onAuthStateChanged fires still get a chance to react. */
window.whenUserLoaded = function (cb) {
  if (window.currentUser?.uid) { cb(window.currentUser); return; }
  document.addEventListener("userLoaded", (e) => cb(e.detail), { once: true });
};

/* ════════════════════════════════════════════════════════════
   BETÖLTŐ UI – progress csík + váltakozó tipp szöveg
   Csak akkor fut le, amikor VALÓBAN le kell tölteni a Firebase
   adatokat — vagyis csak az app első megnyitásakor, ebben a
   böngésző fülben. Oldalváltásnál (ha már van cache) nem jelenik meg.
════════════════════════════════════════════════════════════ */
let tipInterval = null;

function injectLoaderStyles() {
  if (document.getElementById("wt-loader-style")) return;
  const css = `
    #wtProgressTrack {
      position: fixed; top: 0; left: 0; right: 0; height: 3px;
      background: rgba(0,0,0,.08); z-index: 10000;
    }
    #wtProgressFill {
      height: 100%; width: 2%; background: #111;
      transition: width .35s ease;
    }
    #wtTipBox {
      position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%);
      z-index: 10000; display: flex; align-items: center; gap: 8px;
      max-width: min(90vw, 440px);
      background: #fff; border: 1px solid #ececec; border-radius: 999px;
      padding: 10px 18px; box-shadow: 0 8px 24px rgba(0,0,0,.08);
      font: 400 13px/1.4 'DM Sans', system-ui, sans-serif; color: #374151;
      opacity: 1; transition: opacity .25s ease;
    }
    #wtTipBox .material-symbols-rounded { font-size: 16px; color: #111; flex-shrink: 0; }
    #wtTipText { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #wtTipBox.wt-tip-fade { opacity: 0; }
  `;
  const style = document.createElement("style");
  style.id = "wt-loader-style";
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

function showLoaderUI() {
  injectLoaderStyles();
  if (document.getElementById("wtProgressTrack")) return;

  const track = document.createElement("div");
  track.id = "wtProgressTrack";
  track.innerHTML = `<div id="wtProgressFill"></div>`;
  document.body.appendChild(track);

  const tipBox = document.createElement("div");
  tipBox.id = "wtTipBox";
  tipBox.innerHTML = `<span class="material-symbols-rounded">tips_and_updates</span><span id="wtTipText"></span>`;
  document.body.appendChild(tipBox);

  const tipText = tipBox.querySelector("#wtTipText");
  let i = 0;
  const setTip = () => { tipText.textContent = loadingTips[i % loadingTips.length] || ""; i++; };
  setTip();

  if (loadingTips.length > 1) {
    tipInterval = setInterval(() => {
      tipBox.classList.add("wt-tip-fade");
      setTimeout(() => { setTip(); tipBox.classList.remove("wt-tip-fade"); }, 250);
    }, 2600);
  }
}

function setLoaderProgress(pct) {
  const fill = document.getElementById("wtProgressFill");
  if (fill) fill.style.width = Math.max(2, Math.round(pct * 100)) + "%";
}

function removeLoaderUI() {
  if (tipInterval) { clearInterval(tipInterval); tipInterval = null; }
  document.getElementById("wtProgressTrack")?.remove();
  document.getElementById("wtTipBox")?.remove();
}

/* ════════════════════════════════════════════════════════════
   REVEAL — egyetlen közös belépési pont minden oldalon.
   instant = true  -> nincs skeleton villanás (cache-ből jövünk)
   instant = false -> normál fade-out (első betöltés után)
════════════════════════════════════════════════════════════ */
window.revealApp = function (instant) {
  const skel = document.getElementById("skeletonScreen");
  const app  = document.getElementById("appView");
  removeLoaderUI();

  if (app) {
    if (getComputedStyle(app).display === "none") app.style.display = "flex";
    app.classList.add("fade-in");
  }
  if (skel) skel.classList.add("fade-out");

  if (instant) {
    if (skel) skel.style.display = "none";
    return;
  }
  setTimeout(() => { if (skel) skel.style.display = "none"; }, 250);
};

/* ════════════════════════════════════════════════════════════
   AUTH + FIREBASE ADATOK (csak 1x az app megnyitásakor)
════════════════════════════════════════════════════════════ */
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

    /* ── Firebase adatok betöltése: EGYSZER, munkamenetenként ── */
    const cached = getCache(user.uid);

    if (cached) {
      // Van már friss adat -> nincs skeleton, azonnali váltás.
      window.WT = window.WT || {};
      window.WT.data = cached;
      await new Promise(requestAnimationFrame);
      document.dispatchEvent(new CustomEvent("dataReady", { detail: cached }));
      window.revealApp(true);
    } else {
      // Első megnyitás ebben a fülben -> skeleton + progress csík + tippek.
      showLoaderUI();
      const data = await preloadAll(user.uid, setLoaderProgress);
      window.WT = window.WT || {};
      window.WT.data = data;
      // Két animációs frame, hogy a DOM biztosan kifessen, mielőtt eltűnik a skeleton.
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      document.dispatchEvent(new CustomEvent("dataReady", { detail: data }));
      window.revealApp();
    }
  } catch (err) {
    console.error("User load error:", err);
    removeLoaderUI();
    // A failed optional preload must not leave a page permanently hidden
    // behind its skeleton. The page can still render its static UI and any
    // page-specific data that is available.
    window.revealApp();
  }
});

/* ════════════════════════════════════════════════════════════
   DOM READY – logout, delete-account modal
════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  /* ── Logout ────────────────────────────────────────────── */
  const btn = document.getElementById("logout");
  if (btn) {
    btn.addEventListener("click", async () => {
      clearCache();
      await signOut(auth);
      localStorage.removeItem("loggedInUserId");
      window.location.href = "index.html";
    });
  }

  /* ── Delete-account modal (csak settings.html-en) ──────── */
  const deleteBtn = document.getElementById("delete");
  const modal = document.getElementById("deleteModal");
  const codeElement = document.getElementById("confirmationCode");
  const input = document.getElementById("confirmationInput");
  const confirmBtn = document.getElementById("confirmDelete");
  const cancelBtn = document.getElementById("cancelDelete");
  const cancelBtn2 = document.getElementById("cancelDelete2");

  // This delete-account UI only exists on settings.html.
  // homepage.js loads on every page, so bail out quietly elsewhere.
  if (!deleteBtn || !modal || !codeElement || !input || !confirmBtn) return;

  let confirmationCode = "";

  deleteBtn.addEventListener("click", () => {
    confirmationCode = generatePassword(8);

    codeElement.textContent = confirmationCode;
    input.value = "";

    modal.classList.add("show");

    setTimeout(() => {
      input.focus();
    }, 50);
  });

  function closeModal() {
    modal.classList.remove("show");
    input.value = "";
    confirmationCode = "";
  }

  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (cancelBtn2) cancelBtn2.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  confirmBtn.addEventListener("click", () => {
    if (input.value.trim() !== confirmationCode) {
      input.style.borderColor = "#cf222e";
      input.focus();
      setTimeout(() => { input.style.borderColor = ""; }, 1000);
      return;
    }
    closeModal();
    // DELETE ACCOUNT HERE
    console.log("Account deletion confirmed");
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") confirmBtn.click();
    if (event.key === "Escape") closeModal();
  });
});

function generatePassword(length = 8) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const values = new Uint32Array(length);
  crypto.getRandomValues(values);

  let result = "";

  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }

  return result;
}