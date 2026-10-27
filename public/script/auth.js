import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc, collection, writeBatch
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

function showMessage(message, divId) {
  const el = document.getElementById(divId);
  if (!el) return;
  el.style.display = "block";
  el.textContent = message;
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

/* ── Invite link (?invite=CODE) ───────────────────── */
const inviteCode = new URLSearchParams(location.search).get("invite");
let invite = null;
if (inviteCode) {
  (async () => {
    try {
      const snap = await getDoc(doc(db, "invites", inviteCode));
      if (snap.exists() && !snap.data().used) {
        invite = snap.data();
        window.WTWizard?.enterInviteMode(invite);
      } else {
        showMessage("This invite link is invalid or has already been used.", "signInMessage");
      }
    } catch (err) {
      showMessage(cleanError(err), "signInMessage");
    }
  })();
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
    const teamSize = parseInt(document.getElementById("teamNumber").value, 10) || 1;

    if (!fName || !lName || !business || !phone || !email || !password) {
      showMessage("Please fill in all required fields.", "signUpMessage"); return;
    }
    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.", "signUpMessage"); return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      if (invite) {
        /* Teammate joining through a link */
        await setDoc(doc(db, "users", uid), {
          firstName: fName, lastName: lName, Business: invite.business || business,
          Phone: phone, email, teamId: invite.teamId, role: invite.role || "member",
          inviteCode
        });
        await updateDoc(doc(db, "invites", inviteCode), { used: true, usedBy: uid });
        await updateDoc(doc(db, "teams", invite.teamId, "members", invite.memberId), {
          status: "joined", uid
        });
      } else {
        /* Owner: account + team + teammates (manual or invited) in one batch */
        const batch = writeBatch(db);
        batch.set(doc(db, "users", uid), {
          firstName: fName, lastName: lName, Business: business, Phone: phone, email,
          teamId: uid, role: "owner", teamSize
        });
        batch.set(doc(db, "teams", uid), { ownerId: uid, business });

        const members = window.WTWizard ? window.WTWizard.getMembers() : [];
        members.forEach((m) => {
          const ref = doc(collection(db, "teams", uid, "members"));
          const invited = m.method === "link";
          batch.set(ref, {
            name: m.name, email: m.email, role: m.role,
            status: invited ? "invited" : "listed",
            inviteCode: invited ? m.code : null
          });
          if (invited) {
            batch.set(doc(db, "invites", m.code), {
              teamId: uid, memberId: ref.id, name: m.name, email: m.email,
              role: m.role, business, used: false
            });
          }
        });
        await batch.commit();
      }

      localStorage.setItem("loggedInUserId", uid);
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
  const handleSignIn = async (event) => {
    event.preventDefault();
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
  };
  const signInForm = signIn.closest("form");
  if (signInForm) signInForm.addEventListener("submit", handleSignIn);
  else signIn.addEventListener("click", handleSignIn);
}

/* ── Google ──────────────────────────────────────── */
const googleBtn = document.getElementById("googleLogin");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      localStorage.setItem("loggedInUserId", result.user.uid);

      const snap = await getDoc(doc(db, "users", result.user.uid));
      if (!snap.exists()) {
        const names = (result.user.displayName || "Google User").split(" ");
        await setDoc(doc(db, "users", result.user.uid), {
          firstName: names[0] || "", lastName: names.slice(1).join(" ") || "",
          Business: "", Phone: "", email: result.user.email,
          teamId: result.user.uid, role: "owner"
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