import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, getDoc, doc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";


const EMAILJS_CONFIG = {
  PUBLIC_KEY: "1zAdsgpuvagBC3fHu",  // 🔴 EZT MÁSOLD KI A DASHBOARD-RÓL!
  SERVICE_ID: "service_k3jizwe",       // EmailJS Service ID  
  TEMPLATE_ID: "template_9v6wmpj"      // EmailJS Template ID
};

// ── Email Service ──────────────────────────────────────
const EmailService = {
  // EmailJS betöltése
  loadEmailJS() {
    return new Promise((resolve, reject) => {
      if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      script.async = true;
      script.onload = () => {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  // Visszaigazoló email küldése AZONNAL
  async sendBookingConfirmation(bookingData) {
    try {
      console.log("📧 Email küldés indítása...");
      console.log("🔑 Public Key:", EMAILJS_CONFIG.PUBLIC_KEY);
      
      // Business info lekérése
      let businessInfo = null;
      if (bookingData.businessId && bookingData.businessId !== "unassigned") {
        const snap = await getDoc(doc(db, "users", bookingData.businessId));
        if (snap.exists()) {
          businessInfo = snap.data();
        }
      }

      const businessName = businessInfo?.Business || "WT Veterinary Clinic";
      const businessPhone = businessInfo?.Phone || "+36 1 234 5678";
      const businessEmail = businessInfo?.email || "info@wtclinic.com";

      // EmailJS betöltése
      await this.loadEmailJS();

      // Email adatok összeállítása
      const emailParams = {
        to_email: bookingData.email,
        to_name: bookingData.ownerName,
        service: bookingData.service,
        pet_name: bookingData.petName,
        pet_breed: bookingData.breed || "Nem megadva",
        pet_age: bookingData.petAge || "Nem megadva",
        date: this.formatDate(bookingData.date),
        time: bookingData.time,
        price: bookingData.price ? `${bookingData.price.toLocaleString("hu-HU")} Ft` : "Egyeztetés alapján",
        notes: bookingData.notes || "Nincs megjegyzés",
        business_name: businessName,
        business_phone: businessPhone,
        business_email: businessEmail,
        phone: bookingData.phone,
        booking_id: bookingData.bookingId
      };

      console.log("📧 Email küldése folyamatban...", emailParams);

      // Email küldése AZONNAL
      const response = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        emailParams
      );

      console.log("✅ Visszaigazoló email SIKERESEN elküldve!", response);
      return true;

    } catch (error) {
      console.error("❌ Email küldési hiba:", error);
      console.error("❌ Hibakód:", error.status);
      console.error("❌ Hibaszöveg:", error.text);
      return false;
    }
  },

  // Dátum formázás
  formatDate(dateStr) {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr + "T00:00");
    return date.toLocaleDateString("hu-HU", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
};

// ── TESZT FÜGGVÉNY ──────────────────────────────────
window.testEmailJS = async function() {
  console.log("🧪 EmailJS teszt indítása...");
  console.log("🔑 Használt Public Key:", EMAILJS_CONFIG.PUBLIC_KEY);
  
  try {
    const testData = {
      email: prompt("Add meg a teszt email címet:", "teszt@example.com"),
      ownerName: "Teszt Felhasználó",
      petName: "Teszt Kutya",
      service: "Teszt szolgáltatás",
      date: new Date().toISOString().slice(0, 10),
      time: "10:00",
      price: 15000,
      phone: "+36 20 123 4567",
      notes: "Teszt megjegyzés",
      breed: "Vizsla",
      petAge: "3 év",
      businessId: null,
      bookingId: "test_123"
    };
    
    if (!testData.email) {
      alert("❌ Nincs email cím megadva!");
      return;
    }
    
    const result = await EmailService.sendBookingConfirmation(testData);
    
    if (result) {
      console.log("✅ Teszt email SIKERESEN elküldve!");
      alert("✅ Teszt email sikeresen elküldve! Ellenőrizd a postaládádat!");
    } else {
      console.log("❌ Teszt email küldése sikertelen!");
      alert("❌ Teszt email küldése sikertelen! Nézd meg a konzolt (F12) a hibaüzenetért!");
    }
  } catch (error) {
    console.error("❌ Teszt hiba:", error);
    alert("❌ Hiba történt: " + error.message);
  }
};

// ── State ─────────────────────────────────────────────
const state = {
  step:         1,
  businessId:   null,
  businessInfo: null,
  plans:        [],
  selectedPlan: null,
  selectedDate: null,
  selectedTime: null,
  bookedSlots:  []
};

const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00"
];

// ── Category → icon + color (mirrors the Plans admin page, so a
// service looks the same there and here on the public booking page) ──
const CATEGORY_META = {
  checkup:  { label:"Health" },
  vaccine:  { label:"Vaccination" },
  dental:   { label:"Dental" },
  grooming: { label:"Grooming" },
  walking:  { label:"Walking" },
  training: { label:"Training" },
  surgery:  { label:"Surgery" },
  other:    { label:"Other" },
};
function categoryMeta(c){ return CATEGORY_META[c] || CATEGORY_META.other; }

// ── Boot ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  state.businessId = params.get("uid");

  await loadBusiness();
  await loadPlans();
  renderStep(1);
  setupDateInput();
  
  console.log("📧 EmailJS teszt: Írd be a konzolba: testEmailJS()");
});

async function loadBusiness() {
  const phoneEl     = document.getElementById("businessPhone");
  const phoneTextEl = document.getElementById("businessPhoneText");
  const emailEl     = document.getElementById("businessEmail");
  const emailTextEl = document.getElementById("businessEmailText");

  if (!state.businessId) {
    document.getElementById("businessName").textContent = "WT Booking";
    document.getElementById("businessDesc").textContent = "Veterinary & Dog Walking Services";
    return;
  }
  try {
    const snap = await getDoc(doc(db, "users", state.businessId));
    if (snap.exists()) {
      const d = snap.data();
      state.businessInfo = d;
      document.getElementById("businessName").textContent = d.Business || "WT Clinic";
      document.getElementById("businessDesc").textContent =
        `Professional veterinary & dog walking services`;

      const phone = (d.Phone || "").trim();
      const email = (d.email || "").trim();

      // Works whether businessPhone/businessEmail are the plain <a> version
      // or the icon+text version (with a nested #businessPhoneText span).
      if (phoneEl) {
        const tel = phone ? (phone.startsWith("+") ? phone : "+" + phone.replace(/\D/g, "")) : "";
        phoneEl.setAttribute("href", tel ? `tel:${tel}` : "tel:");
        if (phoneTextEl) {
          phoneTextEl.textContent = phone;
          phoneEl.classList.toggle("has-value", !!phone);
        } else {
          phoneEl.textContent = phone;
        }
      }

      if (emailEl) {
        emailEl.setAttribute("href", email ? `mailto:${email}` : "mailto:");
        if (emailTextEl) {
          emailTextEl.textContent = email;
          emailEl.classList.toggle("has-value", !!email);
        } else {
          emailEl.textContent = email;
        }
      }
    }
  } catch (err) {
    console.error("Business load error:", err);
  }
}

async function loadPlans() {
  try {
    let q = state.businessId
      ? query(collection(db, "plans"), where("userId", "==", state.businessId))
      : query(collection(db, "plans"));

    const snap = await getDocs(q);
    state.plans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Plans load error:", err);
  }
}

// ── Step navigation ───────────────────────────────────
window.goStep = function(n) {
  if (n === 2 && !state.selectedPlan) {
    showError("step1Error", "Please select a service.");
    return;
  }
  if (n === 3 && (!state.selectedDate || !state.selectedTime)) {
    showError("step2Error", "Please pick a date and time.");
    return;
  }
  state.step = n;
  renderStep(n);
};

function renderStep(n) {
  hideDescPopover();
  document.querySelectorAll(".step-pane").forEach((el, i) => {
    el.classList.toggle("active", i + 1 === n);
  });
  document.querySelectorAll(".step-indicator").forEach((el, i) => {
    el.classList.toggle("done",   i + 1 <  n);
    el.classList.toggle("active", i + 1 === n);
    el.classList.toggle("todo",   i + 1 >  n);
  });

  clearErrors();

  if (n === 1) renderServices();
  if (n === 2) loadTimeSlots();
  if (n === 3) renderSummary();
}

// ── Step 1 – Services ─────────────────────────────────
function renderServices() {
  const el = document.getElementById("serviceGrid");
  if (!el) return;

  if (!state.plans.length) {
    el.innerHTML = `<div class="no-services">No services available. Contact the clinic directly.</div>`;
    return;
  }

  el.innerHTML = state.plans.map(p => {
    const selected = state.selectedPlan?.id === p.id;
    const meta = categoryMeta(p.category);
    return `
    <div class="service-card ${selected ? "selected" : ""}"
         onclick="selectService('${p.id}')">
      <div class="svc-top">
        <div class="svc-info">
          <span class="svc-category">${esc(meta.label)}</span>
          <div class="svc-name">${esc(p.name)}</div>
          ${p.duration ? `<div class="svc-dur"><span class="material-symbols-rounded">schedule</span>${esc(p.duration)}</div>` : ""}
        </div>
        ${selected ? `<div class="svc-check"><span class="material-symbols-rounded">check</span></div>` : ""}
      </div>
      ${p.desc ? `<p class="svc-desc">${esc(p.desc)}</p>
      <button class="svc-info-btn" type="button" data-info="${p.id}">
        <span class="material-symbols-rounded">info</span>Teljes leírás
      </button>` : ""}
      <div class="svc-price-row">
        <span class="svc-price">${p.price ? p.price.toLocaleString("hu-HU") + " Ft" : "Contact for price"}</span>
        <span class="svc-session">per session</span>
      </div>
    </div>
  `;
  }).join("");

  el.querySelectorAll("[data-info]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const plan = state.plans.find(pl => pl.id === btn.dataset.info);
      if (plan) toggleDescPopover(btn, plan);
    });
  });
}

// ── Description popover (for plans whose description doesn't fit
// in the 2-line clamp on the card) ──────────────────────────────
function toggleDescPopover(anchorEl, plan) {
  const pop = document.getElementById("descPopover");
  if (pop.classList.contains("show") && pop.dataset.for === plan.id) {
    hideDescPopover();
    return;
  }
  document.getElementById("descPopoverTitle").textContent = plan.name || "";
  document.getElementById("descPopoverText").textContent = plan.desc || "";
  pop.dataset.for = plan.id;
  pop.classList.add("show");
  positionDescPopover(anchorEl);
}
function positionDescPopover(anchorEl) {
  const pop = document.getElementById("descPopover");
  const r = anchorEl.getBoundingClientRect();
  const pw = pop.offsetWidth || 260;
  let left = r.left - pw / 2 + 10;
  left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
  let top = r.bottom + 8;
  if (top + 90 > window.innerHeight) {
    top = r.top - pop.offsetHeight - 8;
  }
  pop.style.left = left + "px";
  pop.style.top = Math.max(8, top) + "px";
}
function hideDescPopover() {
  const pop = document.getElementById("descPopover");
  pop.classList.remove("show");
  delete pop.dataset.for;
}
document.addEventListener("click", (e) => {
  const pop = document.getElementById("descPopover");
  if (!pop || !pop.classList.contains("show")) return;
  if (pop.contains(e.target)) return;
  hideDescPopover();
});
window.addEventListener("resize", hideDescPopover);
window.addEventListener("scroll", hideDescPopover, true);

window.selectService = function(id) {
  hideDescPopover();
  state.selectedPlan = state.plans.find(p => p.id === id) || null;
  renderServices();
};

// ── Step 2 – Date & Time ──────────────────────────────
function setupDateInput() {
  const el = document.getElementById("bookDate");
  if (!el) return;
  const today = new Date().toISOString().slice(0, 10);
  el.min = today;
  el.value = today;
  el.addEventListener("change", loadTimeSlots);
}

async function loadTimeSlots() {
  state.selectedDate = document.getElementById("bookDate")?.value;
  if (!state.selectedDate) return;

  try {
    let q = state.businessId
      ? query(collection(db, "bookings"),
          where("businessId", "==", state.businessId),
          where("date", "==", state.selectedDate))
      : query(collection(db, "bookings"), where("date", "==", state.selectedDate));

    const snap = await getDocs(q);
    state.bookedSlots = snap.docs
      .map(d => d.data())
      .filter(b => b.status !== "cancelled")
      .map(b => b.time);
  } catch (err) {
    state.bookedSlots = [];
  }

  renderTimeSlots();
}

function renderTimeSlots() {
  const el = document.getElementById("timeSlots");
  if (!el) return;
  el.innerHTML = TIME_SLOTS.map(t => {
    const booked = state.bookedSlots.includes(t);
    const active = state.selectedTime === t;
    return `<button
      class="time-slot ${booked ? "booked" : ""} ${active && !booked ? "active" : ""}"
      ${booked ? "disabled" : `onclick="selectTime('${t}')"`}>
      ${t}${booked ? '<span class="slot-taken">Taken</span>' : ""}
    </button>`;
  }).join("");
}

window.selectTime = function(t) {
  state.selectedTime = t;
  renderTimeSlots();
};

// ── Step 3 – Summary ──────────────────────────────────
function renderSummary() {
  const el = document.getElementById("bookingSummary");
  if (!el || !state.selectedPlan) return;
  el.innerHTML = `
    <div class="summary-row"><span>Service</span><strong>${esc(state.selectedPlan.name)}</strong></div>
    <div class="summary-row"><span>Date</span><strong>${formatDate(state.selectedDate)}</strong></div>
    <div class="summary-row"><span>Time</span><strong>${esc(state.selectedTime)}</strong></div>
    <div class="summary-row"><span>Price</span><strong>${state.selectedPlan.price ? state.selectedPlan.price.toLocaleString("hu-HU") + " Ft" : "TBD"}</strong></div>
  `;
}

// ── Step 4 – Submit ───────────────────────────────────
window.submitBooking = async function() {
  const g = id => document.getElementById(id)?.value.trim() || "";
  const ownerName = g("ownerName");
  const petName   = g("petName");
  const phone     = g("phone");
  const email     = g("email");
  const breed     = g("breed");
  const petAge    = g("petAge");
  const notes     = g("notes");

  if (!ownerName || !petName || !phone) {
    showError("step3Error", "Name, pet name and phone are required.");
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true; btn.textContent = "Foglalás megerősítése…";

  try {
    const bookingRef = await addDoc(collection(db, "bookings"), {
      businessId: state.businessId || "unassigned",
      ownerName, petName, breed, petAge, phone, email, notes,
      service:   state.selectedPlan.name,
      serviceId: state.selectedPlan.id,
      price:     state.selectedPlan.price || null,
      date:      state.selectedDate,
      time:      state.selectedTime,
      status:    "pending",
      createdAt: serverTimestamp()
    });

    // Create message notification for the vet
    if (state.businessId) {
      await addDoc(collection(db, "messages"), {
        userId: state.businessId,
        type: "booking",
        title: `New booking: ${ownerName}`,
        subject: `${petName} – ${state.selectedPlan.name} on ${state.selectedDate}`,
        from: ownerName,
        body: `${ownerName} has booked "${state.selectedPlan.name}" for ${petName} on ${state.selectedDate} at ${state.selectedTime}.\n\nPhone: ${phone}\nEmail: ${email || "—"}\nBreed: ${breed || "—"}\nNotes: ${notes || "None"}`,
        read: false,
        bookingId: bookingRef.id,
        bookingData: {
          ownerName, petName, breed, phone, email, notes,
          service: state.selectedPlan.name,
          date: state.selectedDate,
          time: state.selectedTime
        },
        createdAt: serverTimestamp()
      });
    }

    // ── Auto-add this person to the vet's Clients list ─
    // (best-effort: never block the booking if this fails)
    if (state.businessId) {
      try {
        const existing = await getDocs(query(
          collection(db, "clients"),
          where("userId", "==", state.businessId),
          where("phone",  "==", phone)
        ));
        const samePet = existing.docs.find(d =>
          ((d.data().petName || "").toLowerCase() === petName.toLowerCase())
        );
        if (!samePet) {
          await addDoc(collection(db, "clients"), {
            userId:       state.businessId,
            ownerName,
            ownerEmail:   email || "",
            phone,
            address:      "",
            petName,
            species:      "dog",
            breed:        breed || "",
            age:          parseFloat(petAge) || null,
            weight:       null,
            vaccinations: "",
            medicalNotes: notes || "",
            source:       "booking",
            firstBookingId: bookingRef.id,
            createdAt:    serverTimestamp()
          });
        }
      } catch (e) {
        console.warn("Could not auto-add client:", e);
      }
    }

    // ── EMAIL KÜLDÉS AZONNAL ──────────────────────────
    if (email) {
      const bookingData = {
        bookingId: bookingRef.id,
        businessId: state.businessId || "unassigned",
        ownerName,
        petName,
        breed,
        petAge,
        phone,
        email: email,
        notes,
        service: state.selectedPlan.name,
        date: state.selectedDate,
        time: state.selectedTime,
        price: state.selectedPlan.price || null
      };

      // Email küldése (nem blokkolja a foglalást)
      EmailService.sendBookingConfirmation(bookingData)
        .then(() => {
          console.log("✅ Visszaigazoló email elküldve a felhasználónak!");
        })
        .catch(err => {
          console.warn("⚠️ Email küldés sikertelen, de a foglalás rögzítve:", err);
        });
    } else {
      console.log("ℹ️ Nincs email cím megadva, email nem lett küldve.");
    }

    showConfirmation(ownerName, petName);
  } catch (err) {
    console.error("Booking error:", err);
    showError("step3Error", "Something went wrong. Please try again or call us directly.");
    btn.disabled = false; btn.textContent = "Confirm Booking";
  }
};

function showConfirmation(ownerName, petName) {
  document.getElementById("bookingFlow").style.display = "none";
  const el = document.getElementById("confirmationScreen");
  el.style.display = "block";
  el.querySelector(".conf-name").textContent = ownerName;
  el.querySelector(".conf-service").textContent =
    `${state.selectedPlan.name} for ${petName}`;
  el.querySelector(".conf-datetime").textContent =
    `${formatDate(state.selectedDate)} at ${state.selectedTime}`;
}

/* helpers */
function showError(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = "block"; } }
function clearErrors() { document.querySelectorAll(".step-error").forEach(e => { e.textContent = ""; e.style.display = "none"; }); }
function formatDate(s) { if (!s) return "—"; return new Date(s + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }


console.log("EmailJS betöltve! Teszt: testEmailJS()");