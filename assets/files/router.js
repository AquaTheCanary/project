// Project canonical URL resolver and shared appearance controller.
(function () {
  "use strict";
  const isGitHubPages = location.hostname.toLowerCase().endsWith(".github.io");
  const repositoryBase = isGitHubPages ? "/project" : "";
  window.APP_BASE_PATH = repositoryBase;
  const routeMap = [
    [/^\/home\/?$/, "/"],
    [/^\/auth\/personal\/login\/?$/, "/login/personal/"],
    [/^\/auth\/organisation\/login\/?$/, "/login/organisation/"],
    [/^\/auth\/personal\/register\/?$/, "/register/personal/"],
    [/^\/auth\/organisation\/register\/?$/, "/register/organisation/"],
    [/^\/websites\/?$/, "/sites/"],
    [/^\/websites\/new\/?$/, "/sites/new/"],
    [/^\/websites\/editor\/?$/, "/sites/new/"],
    [/^\/present\/?$/, "/presentation/"],
    [/^\/presentations\/?$/, "/presentation/"],
    [/^\/presentations\/new\/?$/, "/presentation/new/"],
    [/^\/presentations\/editor\/?$/, "/presentation/new/"],
    [/^\/presenter\/?$/, "/presentation/"],
    [/^\/forms\/?$/, "/forms/new/"]
  ];
  window.getAppUrl = function (path) {
    const value = String(path || "/").trim();
    let clean = "/" + value.replace(/^\/+/, "");
    for (const [pattern, target] of routeMap) {
      if (pattern.test(clean)) { clean = target + clean.slice(clean.match(pattern)[0].length); break; }
    }
    return repositoryBase + (clean === "/" ? "/" : clean);
  };
  function applyRoutes(root = document) {
    root.querySelectorAll("a[data-route]").forEach(anchor => {
      const route = anchor.getAttribute("data-route");
      if (route) anchor.href = window.getAppUrl(route);
    });
  }
  window.applyStudioRoutes = applyRoutes;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => applyRoutes());
  else applyRoutes();

  function repairBrandAssets(root = document) {
    const base = window.getAppUrl("/assets/images/");
    root.querySelectorAll('img[src*="project-logo.svg"],img[src*="project-mark.svg"],img[src*="interactive-studio-icon.svg"]').forEach(img => {
      const tabLike = /favicon|tablogo/i.test(img.alt || "");
      const target = base + (tabLike ? "newp.png" : "newp-nobg.png");
      if (!img.src.endsWith(tabLike ? "newp.png" : "newp-nobg.png")) img.src = target;
      img.onerror = () => { img.onerror = null; img.src = base + "newp.png"; };
    });
    root.querySelectorAll('link[rel~="icon"]').forEach(icon => {
      if (/project-(logo|mark)\.svg|interactive-studio-icon\.svg/.test(icon.href)) icon.href = base + "newp.png";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => repairBrandAssets());
  else repairBrandAssets();
  try {
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) repairBrandAssets(node);
    }))).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  function enforceLightAppearance() {
    const root = document.documentElement;
    if (root.dataset.theme !== "light") root.dataset.theme = "light";
    if (root.style.colorScheme !== "light") root.style.colorScheme = "light";
    try { if (localStorage.getItem("is-theme") !== "light") localStorage.setItem("is-theme", "light"); } catch (_) {}
  }
  enforceLightAppearance();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enforceLightAppearance, { once: true });
  try { new MutationObserver(enforceLightAppearance).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] }); } catch (_) {}
  window.addEventListener("storage", event => { if (event.key === "is-theme" && event.newValue !== "light") enforceLightAppearance(); });
})();
