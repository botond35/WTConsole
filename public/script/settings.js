// views/script/settings.js — with working language selector.
import { db, storage } from "../script/firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";
import { t } from "./i18n.js";

let currentUser = null;

// ===============================
// USER LOADED
// ===============================
document.addEventListener("userLoaded", ({ detail: user }) => {
  currentUser = user;

  const preview = document.getElementById("profilePhotoPreview");
  if (user.photoUrl && preview) {
    preview.src = user.photoUrl;
    preview.style.display = "block";
  }

  applyBookingUrl(user);
});

// ===============================
// DOM READY
// ===============================
document.addEventListener("DOMContentLoaded", () => {

  // -------------------------------
  // Dark Mode
  // -------------------------------
  const toggle = document.getElementById("darkToggle");

  if (toggle) {
    toggle.checked = window.WTTheme ? window.WTTheme.isDark()
                                    : localStorage.getItem("darkMode") === "true";

    toggle.addEventListener("change", () => {
      if (window.WTTheme) window.WTTheme.set(toggle.checked);
      else {
        document.documentElement.setAttribute("data-theme", toggle.checked ? "dark" : "light");
        if (toggle.checked) localStorage.setItem("darkMode", "true");
        else localStorage.removeItem("darkMode");
      }
    });
  }

  // -------------------------------
  // Upload Button
  // -------------------------------
  const uploadBtn = document.getElementById("uploadPhotoBtn");
  const photoInput = document.getElementById("profilePhotoInput");
  const preview = document.getElementById("profilePhotoPreview");

  if (uploadBtn && photoInput) {
    uploadBtn.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", async (e) => {
      if (!currentUser) return;
      const file = e.target.files[0];
      if (!file) return;
      try {
        const storageRef = ref(storage, `businessPhotos/${currentUser.uid}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        await updateDoc(doc(db, "users", currentUser.uid), { photoUrl: url });
        preview.src = url;
        preview.style.display = "block";
        alert(t("alert.photoUpdated"));
      } catch (err) {
        console.error(err);
        alert(t("alert.photoFailed"));
      }
    });
  }

  // -------------------------------
  // Use Current Location
  // -------------------------------
  const locationBtn = document.getElementById("useLocationBtn");
  if (locationBtn) {
    locationBtn.addEventListener("click", () => {
      if (!currentUser) return;
      if (!navigator.geolocation) {
        alert(t("alert.geoUnsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await updateDoc(doc(db, "users", currentUser.uid), {
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
            });
            alert(t("alert.locationSaved"));
          } catch (err) {
            console.error(err);
            alert(t("alert.locationFailed"));
          }
        },
        (err) => {
          console.error(err);
          alert(t("alert.locationDenied"));
        }
      );
    });
  }

  // -------------------------------
  // Copy Booking Link
  // -------------------------------
  const copyBtn = document.getElementById("copyLink");
  if (copyBtn) {
    copyBtn.addEventListener("click", async function () {
      const url = document.getElementById("siteUrl").textContent;
      try { await navigator.clipboard.writeText(url); }
      catch { prompt("Copy this URL:", url); }

      this.classList.add("copied");
      this.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        ${t("btn.copied")}
      `;
      setTimeout(() => {
        this.classList.remove("copied");
        this.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          ${t("btn.copy")}
        `;
      }, 2000);
    });
  }

});

// ===============================
// BOOKING URL
// ===============================
function applyBookingUrl(user) {
  const bookingUrl = new URL("booking.html", window.location.href);
  bookingUrl.searchParams.set("uid", user.uid);
  const siteUrl = document.getElementById("siteUrl");
  const openLink = document.getElementById("openBookingLink");
  if (siteUrl) siteUrl.textContent = bookingUrl.href;
  if (openLink) openLink.href = bookingUrl.href;
}

if (window.currentUser?.uid) {
  currentUser = window.currentUser;
  applyBookingUrl(currentUser);
}

/* ─────────── Walktogether path claim: walktogether.com/<type>/<name> ─────────── */
(() => {
  const ROOT = "walktogether.com";
  const RESERVED = new Set(["www","admin","api","app","mail","help","support","login","signup","dashboard","booking","bookings","account","billing","dev","staging","test","settings","home","about","contact","pricing","plans"]);

  const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"").replace(/^-+|-+$/g,"").slice(0,30);
  const hash = s => { let h=5381; for (let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return Math.abs(h); };
  const buildUrl = (type, name) => `${ROOT}/${type}/${name}`;

  const suggest = (name, type) => {
    const base = slug(name);
    if (!base) return [];
    const variants = [base, base + "-booking", "the" + base, base + "hq", base + "-" + type];
    return [...new Set(variants)].map(n => buildUrl(type, n)).slice(0, 6);
  };
  const check = url => {
    const name = url.split("/").pop();
    if (!name || name.length < 3 || RESERVED.has(name)) return { url, available: false };
    return { url, available: hash(url) % 4 !== 0 };
  };

  const $q = document.getElementById("domainQuery");
  const $p = document.getElementById("domainProfession");
  const $btn = document.getElementById("domainSearchBtn");
  const $out = document.getElementById("domainResults");
  if (!$q || !$p || !$btn || !$out) return;

  const render = () => {
    const list = suggest($q.value.trim(), $p.value);
    $out.innerHTML = "";
    if (!list.length) {
      $out.innerHTML = `<div style="font-size:12px;color:#9ca3af;">${t("domain.hint")}</div>`;
      return;
    }
    const claimed = window.WTDomain?.get();
    for (const url of list) {
      const r = check(url);
      const isMine = claimed?.url === url;
      const row = document.createElement("div");
      row.className = "domain-row";
      row.innerHTML = `
        <div style="display:flex;flex-direction:column;min-width:0;">
          <span style="font-family:'DM Mono',monospace;font-size:13px;overflow:hidden;text-overflow:ellipsis;">${r.url}</span>
          <span style="font-size:11px;color:${isMine ? '#2563eb' : (r.available ? '#059669' : '#dc2626')};">
            ${isMine ? "Connected to your page" : (r.available ? t("domain.available") : t("domain.taken"))}
          </span>
        </div>
        ${isMine
          ? `<a class="copy-btn" href="editor.html" style="text-decoration:none;">Open editor</a>`
          : (r.available
              ? `<button class="copy-btn" data-url="${r.url}">${t("domain.claim")}</button>`
              : `<span style="font-size:11px;color:#9ca3af;">—</span>`)}
      `;
      $out.appendChild(row);
    }
    $out.querySelectorAll("button[data-url]").forEach(b => {
      b.addEventListener("click", () => {
        window.WTDomain?.claim(b.dataset.url);
        renderPageLink();
        render();
      });
    });
  };

  /* ── Connected website card: links this address to the page built
        in the page creator / editor. ───────────────────────────── */
  function renderPageLink() {
    const card = document.getElementById("wtPageLinkCard");
    if (!card) return;
    const d = window.WTDomain?.get();
    const tpl = window.WTDomain?.template();

    if (!d) {
      card.innerHTML = `
        <div class="row-info">
          <div class="row-title">Website not connected yet</div>
          <div class="row-desc">Claim an address above, then build the page it points to in the editor.</div>
        </div>
        <a class="copy-btn" href="creat.html" style="text-decoration:none;">Create page</a>`;
      return;
    }

    card.innerHTML = `
      <div class="row-info">
        <div class="row-title">
          <span style="font-family:'DM Mono',monospace;">${d.url}</span>
        </div>
        <div class="row-desc">
          ${d.published ? "Live" : "Claimed – not published yet"}
          ${tpl?.name ? ` · Template: <b>${tpl.name}</b>` : ""}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a class="copy-btn" href="editor.html" style="text-decoration:none;">Edit page</a>
        <button class="copy-btn" id="wtUnclaimBtn" type="button">Release</button>
      </div>`;

    card.querySelector("#wtUnclaimBtn")?.addEventListener("click", () => {
      if (!confirm(`Release ${d.url}?`)) return;
      window.WTDomain?.clear();
      renderPageLink();
      render();
    });
  }

  $btn.addEventListener("click", render);
  $q.addEventListener("keydown", e => { if (e.key === "Enter") render(); });
  $p.addEventListener("change", render);
  document.addEventListener("i18nApplied", render);
  document.addEventListener("wt:domainchange", renderPageLink);

  /* Prefill from the already claimed address */
  const existing = window.WTDomain?.get();
  if (existing) {
    $p.value = existing.type || $p.value;
    $q.value = existing.name || "";
  }
  render();
  renderPageLink();
})();
