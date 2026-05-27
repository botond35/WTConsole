import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

import {
  getFirestore,
  doc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyCG4aidBoanlgeIZSUuEeZHrzpvhdFu9_g",
  authDomain: "wtconsole-6dce4.firebaseapp.com",
  projectId: "wtconsole-6dce4",
  storageBucket: "wtconsole-6dce4.firebasestorage.app",
  messagingSenderId: "6358100299",
  appId: "1:6358100299:web:f1a6b5c02eb687d887e0ce",
  measurementId: "G-5D0K7GWKP9"

};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);


function showMessage(message, divId) {
  const messageDiv = document.getElementById(divId);

  messageDiv.style.display = "block";
  messageDiv.innerHTML = message;

  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 5000);
}



const signUp = document.getElementById("submitSignUp");

if (signUp) {

  signUp.addEventListener("click", async (event) => {

    event.preventDefault();

    const email = document.getElementById("rEmail").value;
    const password = document.getElementById("rPassword").value;
    const firstName = document.getElementById("fName").value;
    const lastName = document.getElementById("lName").value;

    try {

      const userCredential =
        await createUserWithEmailAndPassword(auth, email, password);

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email,
        firstName,
        lastName
      });

      showMessage("Account Created Successfully", "signUpMessage");

      window.location.href = "index.html";

    } catch (error) {

      if (error.code === "auth/email-already-in-use") {
        showMessage("Email already exists", "signUpMessage");
      } else {
        showMessage(error.message, "signUpMessage");
      }
    }
  });
}



const signIn = document.getElementById("submitSignIn");

if (signIn) {

  signIn.addEventListener("click", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {

      const userCredential =
        await signInWithEmailAndPassword(auth, email, password);

      localStorage.setItem(
        "loggedInUserId",
        userCredential.user.uid
      );

      showMessage("Login successful", "signInMessage");

      window.location.href = "home.html";

    } catch (error) {

      if (error.code === "auth/invalid-credential") {
        showMessage("Incorrect Email or Password", "signInMessage");
      } else {
        showMessage(error.message, "signInMessage");
      }
    }
  });
}


const googleBtn = document.getElementById("googleLogin");

if (googleBtn) {

  googleBtn.addEventListener("click", async () => {

    try {

      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      localStorage.setItem(
        "loggedInUserId",
        result.user.uid
      );

      showMessage("Google Login Successful", "signInMessage");

      window.location.href = "home.html";

    } catch (error) {

      showMessage(error.message, "signInMessage");
    }
  });
}


const appleBtn = document.getElementById("appleLogin");

if (appleBtn) {

  appleBtn.addEventListener("click", async () => {

    try {

      const provider = new OAuthProvider("apple.com");

      const result = await signInWithPopup(auth, provider);

      localStorage.setItem(
        "loggedInUserId",
        result.user.uid
      );

      showMessage("Apple Login Successful", "signInMessage");

      window.location.href = "home.html";

    } catch (error) {

      showMessage(error.message, "signInMessage");
    }
  });
}
