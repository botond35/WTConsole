import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import {
  doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

function showMessage(message, divId) {
  const el = document.getElementById(divId);
  if (!el) return;
  el.style.display = "block";
  el.innerHTML = message;
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

function cleanError(error) {
  if (!error?.code) return error?.message || "An unknown error occurred.";
  const map = {
    "auth/invalid-credential":     "Invalid email or password.",
    "auth/wrong-password":         "Invalid email or password.",
    "auth/user-not-found":         "No account found with that email.",
    "auth/email-already-in-use":   "This email is already registered.",
    "auth/invalid-email":          "Invalid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/missing-password":       "Password is required.",
    "auth/user-disabled":          "This account has been disabled.",
    "auth/popup-closed-by-user":   "Sign-in popup was closed.",
    "auth/network-request-failed": "Network error. Check your connection."
  };
  return map[error.code] || error.message.replace(/^Firebase:\s*/, "").replace(/\s*\(auth\/.*\)\.?$/, "");
}

/* ── Sign Up ──────────────────────────────────────── */
const signUp = document.getElementById("submitSignUp");
if (signUp) {
  signUp.addEventListener("click", async () => {
    const fName    = document.getElementById("fName").value.trim();
    const lName    = document.getElementById("lName").value.trim();
    const business = document.getElementById("business").value.trim();
    const phone    = document.getElementById("phone").value.trim();
    const email    = document.getElementById("rEmail").value.trim();
    const password = document.getElementById("rPassword").value;

    if (!fName || !lName || !business || !phone || !email || !password) {
      showMessage("Please fill in all fields.", "signUpMessage"); return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        firstName: fName, lastName: lName,
        Business: business, Phone: phone, email
      });
      localStorage.setItem("loggedInUserId", cred.user.uid);
      showMessage("Registration successful! Redirecting…", "signUpMessage");
      setTimeout(() => { window.location.href = "home.html"; }, 1000);
    } catch (err) {
      showMessage(cleanError(err), "signUpMessage");
    }
  });
}

/* ── Sign In ──────────────────────────────────────── */
const signIn = document.getElementById("submitSignIn");
if (signIn) {
  signIn.addEventListener("click", async () => {
    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!email || !password) { showMessage("Enter your email and password.", "signInMessage"); return; }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem("loggedInUserId", cred.user.uid);
      window.location.href = "home.html";
    } catch (err) {
      showMessage(cleanError(err), "signInMessage");
    }
  });
}

/* ── Google ──────────────────────────────────────── */
const googleBtn = document.getElementById("googleLogin");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      localStorage.setItem("loggedInUserId", result.user.uid);

      // Create user doc if first login
      const { getDoc, setDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js");
      const snap = await getDoc(fsDoc(db, "users", result.user.uid));
      if (!snap.exists()) {
        const names = (result.user.displayName || "Google User").split(" ");
        await setDoc(fsDoc(db, "users", result.user.uid), {
          firstName: names[0] || "", lastName: names.slice(1).join(" ") || "",
          Business: "", Phone: "", email: result.user.email
        });
      }
      window.location.href = "home.html";
    } catch (err) { showMessage(cleanError(err), "signInMessage"); }
  });
}

/* ── Apple ───────────────────────────────────────── */
const appleBtn = document.getElementById("appleLogin");
if (appleBtn) {
  appleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, new OAuthProvider("apple.com"));
      localStorage.setItem("loggedInUserId", result.user.uid);
      window.location.href = "home.html";
    } catch (err) { showMessage(cleanError(err), "signInMessage"); }
  });
}
