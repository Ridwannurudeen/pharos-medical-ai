// Pharos site — one shared bundle across all pages.
(function () {
  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", links.classList.contains("open"));
    });
  }

  // Mark the current page's nav link active (clean-URL aware)
  var path = location.pathname
    .replace(/\/index\.html$/, "/")
    .replace(/\.html$/, "");
  if (path === "") path = "/";
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    var href = a.getAttribute("href").replace(/\.html$/, "");
    if (href === "") href = "/";
    if (href === path || (href === "/" && path === "/"))
      a.classList.add("active");
  });

  // Footer year
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
