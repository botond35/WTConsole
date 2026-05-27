import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

import {
  getFirestore,
  getDoc,
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


onAuthStateChanged(auth, async (user) => {

  if (user) {

    const docRef = doc(db, "users", user.uid);

    try {

      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {

        const userData = docSnap.data();

        document.getElementById("loggedUserFName").innerText =
          userData.firstName;

        document.getElementById("loggedUserLName").innerText =
          userData.lastName;

        document.getElementById("loggedUserEmail").innerText =
          userData.email;
      }

    } catch (error) {
      console.log(error);
    }

  } else {

    window.location.href = "index.html";
  }
});


document.getElementById("logout")
  .addEventListener("click", async () => {

    await signOut(auth);

    localStorage.removeItem("loggedInUserId");

    window.location.href = "index.html";
  });

  