import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCG4aidBoanlgeIZSUuEeZHrzpvhdFu9_g",
  authDomain: "wtconsole-6dce4.firebaseapp.com",
  projectId: "wtconsole-6dce4",
  storageBucket: "wtconsole-6dce4.firebasestorage.app",
  messagingSenderId: "6358100299",
  appId: "1:6358100299:web:f1a6b5c02eb687d887e0ce",
  measurementId: "G-5D0K7GWKP9"

};

// INIT
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// GLOBAL FUNCTIONS
window.openModal = function () {
  document.getElementById("planModal").classList.remove("hidden");
};

window.closeModal = function () {
  document.getElementById("planModal").classList.add("hidden");
};

// LOAD PLANS
async function loadPlans() {
  const container = document.getElementById("plansContainer");
  container.innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "plans"));

  querySnapshot.forEach((docSnap) => {
    const plan = docSnap.data();

    const card = document.createElement("div");
    card.className =
      "bg-gray-50 border border-gray-100 rounded-2xl p-6";

    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-xl font-semibold">${plan.name}</h3>
          <p class="text-gray-500 mt-2">${plan.desc}</p>
        </div>

        <button
          onclick="deletePlan('${docSnap.id}')"
          class="text-red-500 hover:text-red-700"
        >
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>

      <div class="mt-4 text-lg font-bold text-black flex justify-end">
        ${plan.price ? plan.price + " ft" : "No price set"}
      </div>
    `;

    container.appendChild(card);
  });
}

// ADD PLAN
window.addPlan = async function () {
  const name = document.getElementById("planName").value;
  const desc = document.getElementById("planDesc").value;
  const price = document.getElementById("planPrice").value;

  if (!name) return;

  await addDoc(collection(db, "plans"), {
    name,
    desc,
    price
  });

  document.getElementById("planName").value = "";
  document.getElementById("planDesc").value = "";
  document.getElementById("planPrice").value = "";

  closeModal();

  loadPlans();
};

// DELETE PLAN
window.deletePlan = async function (id) {
  await deleteDoc(doc(db, "plans", id));
  loadPlans();
};

// INITIAL LOAD
window.addEventListener("DOMContentLoaded", loadPlans);