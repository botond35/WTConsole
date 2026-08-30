/* ─────────────────────────────────────────────────────────────
   WT domain link — the single source of truth that connects the
   page-address generator (Settings) with the page creator/editor.

   Stored shape (localStorage "wt_page_domain"):
     { type: "clinik", name: "budapestclinik",
       url: "walktogether.com/clinik/budapestclinik",
       claimedAt: 1699999999999, published: false }
   ───────────────────────────────────────────────────────────── */
(function () {
  var KEY = "wt_page_domain";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
    catch (e) { return null; }
  }

  function write(v) {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
    document.dispatchEvent(new CustomEvent("wt:domainchange", { detail: v }));
    return v;
  }

  window.WTDomain = {
    KEY: KEY,
    get: read,
    /** url looks like "walktogether.com/clinik/name" */
    claim: function (url) {
      var parts = String(url).split("/");
      var current = read() || {};
      return write({
        type: parts[1] || "",
        name: parts[2] || "",
        url: url,
        claimedAt: Date.now(),
        published: !!current.published
      });
    },
    setPublished: function (flag) {
      var d = read();
      if (!d) return null;
      d.published = !!flag;
      d.publishedAt = flag ? Date.now() : null;
      return write(d);
    },
    clear: function () { return write(null); },
    /** live address of the built page, or the local preview fallback */
    liveUrl: function (fallback) {
      var d = read();
      return d ? "https://" + d.url : (fallback || "booking.html");
    },
    /** which template the editor is currently building */
    template: function () {
      try { return JSON.parse(localStorage.getItem("wt_template") || "null"); }
      catch (e) { return null; }
    }
  };
})();
