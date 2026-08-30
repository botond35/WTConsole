/* WT theme bootstrap — classic script, loaded in <head> of every page
   BEFORE the body renders so there is no light flash.               */
(function () {
  var KEY = "darkMode";

  function apply(dark) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  apply(localStorage.getItem(KEY) === "true");

  window.WTTheme = {
    isDark: function () { return localStorage.getItem(KEY) === "true"; },
    set: function (dark) {
      if (dark) localStorage.setItem(KEY, "true");
      else localStorage.removeItem(KEY);
      apply(dark);
      document.dispatchEvent(new CustomEvent("wt:themechange", { detail: { dark: !!dark } }));
    },
    toggle: function () { window.WTTheme.set(!window.WTTheme.isDark()); }
  };

  /* keep every open tab in sync */
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) apply(localStorage.getItem(KEY) === "true");
  });
})();
