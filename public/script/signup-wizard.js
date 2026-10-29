/* Sign-up wizard: steps, team members, invite links.
   Exposes window.WTWizard for auth.js */
   (function () {
    const root = document.getElementById("signup");
    if (!root) return;
    const $ = (id) => document.getElementById(id);
    const steps = [...root.querySelectorAll(".step")];
    const dots = [...root.querySelectorAll("#stepper li")];
    const back = $("stepBack"), next = $("stepNext"), submit = $("submitSignUp");
    const list = $("memberList");
    let order = [1, 2, 3, 4], pos = 0;
  
    const stepEl = (n) => steps.find((s) => +s.dataset.step === n);
  
    function show() {
      const n = order[pos];
      steps.forEach((s) => s.classList.toggle("active", +s.dataset.step === n));
      dots.forEach((d) => {
        const i = order.indexOf(+d.dataset.step);
        d.hidden = i < 0;
        d.classList.toggle("current", i === pos);
        d.classList.toggle("done", i >= 0 && i < pos);
        if (i === pos) d.setAttribute("aria-current", "step");
        else d.removeAttribute("aria-current");
        d.querySelector("span").textContent = i >= 0 && i < pos ? "✓" : i + 1;
      });
      back.style.visibility = pos ? "visible" : "hidden";
      const last = pos === order.length - 1;
      next.style.display = last ? "none" : "";
      submit.style.display = last ? "" : "none";
      if (n === 3) teamStep();
    }
  
    function validStep() {
      const s = stepEl(order[pos]);
      s.classList.add("show-errors");
      const bad = [...s.querySelectorAll("input:required")].find((i) => !i.checkValidity());
      if (bad) { bad.focus(); return false; }
      return true;
    }
  
    next.addEventListener("click", () => { if (validStep()) { pos++; show(); } });
    back.addEventListener("click", () => { pos--; show(); });
    submit.addEventListener("click", () => stepEl(4).classList.add("show-errors"));
  
    /* ---- Team step ---- */
    const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
    const newCode = () => {
      const a = new Uint8Array(12);
      crypto.getRandomValues(a);
      return [...a].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
    };
    const linkFor = (code) => location.origin + location.pathname + "?invite=" + code;
  
    function teamStep() {
      const n = parseInt($("teamNumber").value, 10) || 1;
      $("teamHint").textContent = n <= 1
        ? "You’re signing up as solo. Skip this step, or add someone now."
        : "You entered a team of " + n + ". Add " + (n - 1) + " teammate" + (n > 2 ? "s" : "") + " now, or later in Settings.";
      if (n > 1 && !list.children.length) addMember();
    }
  
    function numberRows() {
      [...list.children].forEach((r, i) => (r.querySelector(".member-n").textContent = "Teammate " + (i + 1)));
    }
  
    function refresh(el) {
      const email = el.querySelector(".m-email").value.trim();
      const name = el.querySelector(".m-name").value.trim();
      const link = linkFor(el.dataset.code);
      el.querySelector(".lk").textContent = link;
      const mail = el.querySelector(".mail");
      mail.hidden = !email;
      mail.href = "mailto:" + encodeURIComponent(email) +
        "?subject=" + encodeURIComponent("Join " + ($("business").value || "our team") + " on WT Console") +
        "&body=" + encodeURIComponent("Hi " + name + ",\n\nCreate your account here: " + link);
    }
  
    function addMember() {
      const el = document.createElement("div");
      el.className = "member";
      el.dataset.code = newCode();
      el.dataset.method = "manual";
      el.innerHTML =
        '<div class="member-top"><span class="member-n"></span>' +
        '<button type="button" class="icon-btn rm" aria-label="Remove teammate">&times;</button></div>' +
        '<div class="row">' +
        '<div class="input-group"><i class="fas fa-user"></i><input type="text" class="m-name" placeholder="Name" aria-label="Teammate name" required><label>Name</label></div>' +
        '<div class="input-group"><i class="fas fa-envelope"></i><input type="email" class="m-email" placeholder="Email" aria-label="Teammate email"><label>Email</label></div>' +
        "</div>" +
        '<div class="row member-opts">' +
        '<div class="seg" role="group" aria-label="How to add"><button type="button" data-m="manual" aria-pressed="true">Add now</button><button type="button" data-m="link" aria-pressed="false">Send invite link</button></div>' +
        '<select class="m-role" aria-label="Role"><option value="member">Staff</option><option value="admin">Admin</option></select>' +
        "</div>" +
        '<div class="linkbox" hidden><code class="lk"></code><button type="button" class="copy">Copy</button><a class="mail" hidden>Email it</a></div>' +
        '<small class="hint link-note" hidden>The link works once you create your account. They set their own password.</small>';
      list.appendChild(el);
      numberRows();
      refresh(el);
      el.querySelector(".m-name").focus();
    }
  
    $("addMember").addEventListener("click", addMember);
  
    list.addEventListener("input", (e) => { const m = e.target.closest(".member"); if (m) refresh(m); });
    list.addEventListener("click", (e) => {
      const m = e.target.closest(".member");
      if (!m) return;
      if (e.target.closest(".rm")) { m.remove(); numberRows(); return; }
      const seg = e.target.closest("[data-m]");
      if (seg) {
        m.dataset.method = seg.dataset.m;
        m.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-pressed", b === seg));
        m.querySelector(".linkbox").hidden = seg.dataset.m !== "link";
        m.querySelector(".link-note").hidden = seg.dataset.m !== "link";
        refresh(m);
        return;
      }
      const cp = e.target.closest(".copy");
      if (cp) {
        navigator.clipboard.writeText(linkFor(m.dataset.code));
        cp.textContent = "Copied";
        setTimeout(() => (cp.textContent = "Copy"), 1500);
      }
    });
  
    /* ---- API for auth.js ---- */
    window.WTWizard = {
      getMembers() {
        return [...list.children].map((m) => ({
          name: m.querySelector(".m-name").value.trim(),
          email: m.querySelector(".m-email").value.trim(),
          role: m.querySelector(".m-role").value,
          method: m.dataset.method,
          code: m.dataset.code
        })).filter((m) => m.name);
      },
      // Teammate opened an invite link: only profile + account steps
      enterInviteMode(inv) {
        order = [1, 4];
        pos = 0;
        const socialSignIn = $("signIn");
        if (socialSignIn) socialSignIn.style.display = "none";
        root.style.display = "block";
        $("signupTitle").textContent = "Join your team";
        const b = $("inviteBanner");
        b.textContent = "You’ve been invited to join " + (inv.business || "a team") + ". Create your login to get started.";
        b.style.display = "block";
        const [f, ...l] = (inv.name || "").split(" ");
        $("fName").value = f || "";
        $("lName").value = l.join(" ");
        $("business").value = inv.business || "";
        if (inv.email) { $("rEmail").value = inv.email; $("rEmail").readOnly = true; }
        show();
      }
    };
  
    show();
  })();