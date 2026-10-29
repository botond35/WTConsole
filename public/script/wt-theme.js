(function () {
  const STORAGE_KEY = "wt_theme_preference";
  const root = document.documentElement;

  function getPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch (error) {
      console.error("Could not read the theme preference:", error);
      return "light";
    }
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.textContent = theme === "dark" ? "Dark mode on" : "Dark mode off";
    }
  }

  applyTheme(getPreference());

  document.addEventListener("DOMContentLoaded", function () {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    toggle.addEventListener("click", function () {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch (error) {
        console.error("Could not save the theme preference:", error);
        return;
      }
      applyTheme(nextTheme);
    });
  });
})();
