import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const LOGIN_PAGE = "signup.html";
const uid = localStorage.getItem("loggedInUserId");
const card = document.getElementById("teamCard");

const $ = (id) => document.getElementById(id);
const CH = "abcdefghjkmnpqrstuvwxyz23456789";
const newCode = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => CH[b % CH.length]).join("");
const linkFor = (code) => location.origin + location.pathname.replace(/[^/]*$/, "") + LOGIN_PAGE + "?invite=" + code;
const STATUS = {
  listed:  { label: "Added",          cls: "text-bg-secondary" },
  invited: { label: "Invite pending", cls: "text-bg-warning" },
  joined:  { label: "Joined",         cls: "text-bg-success" }
};

if (uid && card) init();

async function init() {
  const me = (await getDoc(doc(db, "users", uid))).data() || {};
  const teamId = me.teamId || uid;
  const canEdit = (me.role || "owner") !== "member";
  let editing = false;

  // Accounts created before teams existed become the owner of their own team
  if (!me.teamId) {
    await setDoc(doc(db, "users", uid), { teamId: uid, role: "owner" }, { merge: true });
    await setDoc(doc(db, "teams", uid), { ownerId: uid, business: me.Business || "" }, { merge: true });
  }

  const col = collection(db, "teams", teamId, "members");
  const mref = (id) => doc(db, "teams", teamId, "members", id);

  if (!canEdit) {
    $("tmToolbar").classList.add("d-none");
    $("tmAddForm").remove();
  }

  async function createInvite(id, m) {
    const code = newCode();
    await setDoc(doc(db, "invites", code), {
      teamId, memberId: id, name: m.name, email: m.email || "", role: m.role,
      business: me.Business || "", used: false
    });
    await updateDoc(mref(id), { status: "invited", inviteCode: code });
    return code;
  }

  async function render() {
    const snap = await getDocs(col);
    const list = $("tmList");
    const tpl = $("tmRowTpl");
    list.replaceChildren();
    $("tmEmpty").classList.toggle("d-none", !snap.empty);

    snap.docs.forEach((d) => {
      const m = d.data();
      const row = tpl.content.firstElementChild.cloneNode(true);
      row.dataset.id = d.id;
      row.dataset.code = m.inviteCode || "";

      const f = (k) => row.querySelector(`[data-f="${k}"]`);
      f("name").value = m.name || "";
      f("email").value = m.email || "";
      f("role").value = m.role === "admin" ? "admin" : "member";

      const st = STATUS[m.status] || STATUS.listed;
      f("status").textContent = st.label;
      f("status").classList.add(st.cls);

      // inputs editable only in edit mode
      row.querySelectorAll("input, select").forEach((el) => (el.disabled = !editing));

      // action buttons
      const btn = (a) => row.querySelector(`[data-act="${a}"]`);
      btn("link").classList.toggle("d-none", !(canEdit && m.status === "listed"));
      btn("copy").classList.toggle("d-none", !(canEdit && m.status === "invited"));
      btn("revoke").classList.toggle("d-none", !(canEdit && m.status === "invited"));
      btn("remove").classList.toggle("d-none", !(canEdit && editing));

      list.appendChild(row);
    });
  }

  // Auto-save edits
  $("tmList").addEventListener("change", async (e) => {
    const row = e.target.closest(".tm");
    if (!row || !canEdit) return;
    const val = (k) => row.querySelector(`[data-f="${k}"]`).value.trim();
    if (!val("name")) { render(); return; }
    await updateDoc(mref(row.dataset.id), { name: val("name"), email: val("email"), role: val("role") });
  });

  // One delegated click handler for the whole card
  card.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !canEdit) return;
    const act = btn.dataset.act;
    const row = btn.closest(".tm");
    const id = row?.dataset.id;

    if (act === "toggle-edit") {
      editing = !editing;
      btn.textContent = editing ? "Done" : "Edit";
      return render();
    }
    if (act === "copy") {
      await navigator.clipboard.writeText(linkFor(row.dataset.code));
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy link"), 1500);
      return;
    }

    if (act === "revoke") {
      await deleteDoc(doc(db, "invites", row.dataset.code));
      await updateDoc(mref(id), { status: "listed", inviteCode: null });
    } else if (act === "remove") {
      if (row.dataset.code) await deleteDoc(doc(db, "invites", row.dataset.code));
      await deleteDoc(mref(id));
    } else if (act === "link") {
      const val = (k) => row.querySelector(`[data-f="${k}"]`).value.trim();
      const code = await createInvite(id, { name: val("name"), email: val("email"), role: val("role") });
      await navigator.clipboard.writeText(linkFor(code));
    } else if (act === "add-manual" || act === "add-link") {
      const nameEl = $("tmNewName");
      const m = {
        name: nameEl.value.trim(),
        email: $("tmNewEmail").value.trim(),
        role: $("tmNewRole").value
      };
      if (!m.name) { nameEl.focus(); return; }
      const ref = await addDoc(col, { ...m, status: "listed", inviteCode: null });
      if (act === "add-link") {
        const code = await createInvite(ref.id, m);
        await navigator.clipboard.writeText(linkFor(code));
      }
      $("tmNewName").value = "";
      $("tmNewEmail").value = "";
      $("tmNewRole").value = "member";
      bootstrap.Collapse.getOrCreateInstance($("tmAddForm")).hide();
    }
    render();
  });

  render();
}