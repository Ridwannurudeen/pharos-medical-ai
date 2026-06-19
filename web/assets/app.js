// Pharos site - one shared bundle across all pages.
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", links.classList.contains("open"));
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function normalizePath(value) {
    var url = new URL(value, location.href);
    var path = url.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
    return path === "" ? "/" : path;
  }

  var path = normalizePath(location.href);
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    if (a.origin !== location.origin) return;
    var href = normalizePath(a.href);
    if (href === path || (href === "/" && path === "/")) {
      a.classList.add("active");
    }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
