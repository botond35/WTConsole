(function () {
  const ALL_VIEWS = ["clinic", "cashier", "walking", "grooming", "shelter"];
  const PAGE_VIEWS = {
    "clients.html": ["clinic", "walking", "grooming", "shelter"],
    "bookings.html": ["clinic", "walking", "grooming", "shelter"],
    "plans.html": ["clinic", "walking", "grooming"],
    "invoices.html": ["cashier"],
    "analytics.html": ["clinic", "cashier"],
    "messages.html": ["clinic"]
  };

  function applyViews(value) {
    const selected = Array.isArray(value)
      ? value.filter((view) => ALL_VIEWS.includes(view))
      : [];
    const views = selected.length ? selected : ALL_VIEWS;
    const activeViews = new Set(views);

    document.documentElement.dataset.consoleViews = views.join(",");

    document.querySelectorAll("a[href]").forEach((link) => {
      let page;
      try {
        page = new URL(link.href, window.location.href).pathname.split("/").pop();
      } catch (error) {
        return;
      }

      const requiredViews = PAGE_VIEWS[page];
      if (!requiredViews) return;
      const hidden = !requiredViews.some((view) => activeViews.has(view));
      link.hidden = hidden;
      link.style.display = hidden ? "none" : "";
      link.setAttribute("aria-hidden", String(hidden));
      if (hidden) link.setAttribute("tabindex", "-1");
      else link.removeAttribute("tabindex");
    });

    document.querySelectorAll("[data-console-view]").forEach((element) => {
      const requiredViews = element.dataset.consoleView.split(",").map((view) => view.trim());
      const hidden = !requiredViews.some((view) => activeViews.has(view));
      element.hidden = hidden;
      element.style.display = hidden ? "none" : "";
    });
  }

  document.addEventListener("userLoaded", (event) => {
    applyViews(event.detail.consoleViews);
  });
  document.addEventListener("consoleViewsChanged", (event) => {
    applyViews(event.detail);
  });

  if (window.currentUser) applyViews(window.currentUser.consoleViews);
})();
