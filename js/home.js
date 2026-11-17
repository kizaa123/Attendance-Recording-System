(function () {
  "use strict";

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function revealOnScroll() {
    var nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length || prefersReducedMotion()) {
      nodes.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    nodes.forEach(function (el) {
      io.observe(el);
    });
  }

  function signInHref() {
    if (window.AttendifyAuthEntry && AttendifyAuthEntry.signInEntryHref) {
      return AttendifyAuthEntry.signInEntryHref("");
    }
    return "login.html";
  }

  function wireCtas() {
    document.querySelectorAll("[data-href-signin]").forEach(function (btn) {
      btn.setAttribute("href", signInHref());
    });
  }

  function wireNav() {
    var toggle = document.getElementById("home-nav-toggle");
    var panel = document.getElementById("home-nav-panel");
    if (!toggle || !panel) return;
    function setNavOpen(open) {
      panel.classList.toggle("is-open", open);
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", function () {
      setNavOpen(!panel.classList.contains("is-open"));
    });
    panel.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setNavOpen(false);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) setNavOpen(false);
    });
  }

  document.documentElement.classList.add("home-js-ready");
  wireCtas();
  wireNav();
  revealOnScroll();
})();