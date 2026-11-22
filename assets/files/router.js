// Shared route resolver and appearance controller for Interactive Studio.
(function () {
  "use strict";
  const isGitHubPages = location.hostname.toLowerCase().endsWith(".github.io");
  const repositoryBase = isGitHubPages ? "/interactivestudio" : "";
  window.APP_BASE_PATH = repositoryBase;
  window.getAppUrl = function (path) {
    const value = String(path || "/").trim();
    let clean = "/" + value.replace(/^\/+/, "");
    const routeMap = [
      [/^\/presentations\/editor\/?$/, "/present/"],
      [/^\/presentations\/new\/?$/, "/present/new/"],
      [/^\/presentations\/view\/audience\/?$/, "/present/view/"],
      [/^\/presentations\/view\/presenter\/?$/, "/present/presenter/"],
      [/^\/websites\/?$/, "/sites/"],
      [/^\/websites\/new\/?$/, "/sites/new/"],
      [/^\/websites\/editor\/?$/, "/sites/editor/"],
      [/^\/websites\/publish\/?$/, "/sites/publish/"],
      [/^\/websites\/([a-z0-9-]+)\/(editor|publish)\/?$/i, "/sites/$1/$2/"]
    ];
    for (const [pattern, target] of routeMap) {
      if (pattern.test(clean)) { clean = clean.replace(pattern, target); break; }
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


  // Central logo resolver: keep every page on the canonical transparent wordmark
  // and the tab icon on the branded square asset, regardless of legacy markup.
  function repairBrandAssets(root = document) {
    const base = window.getAppUrl("/assets/images/");
    root.querySelectorAll('img[src*="project-logo.svg"],img[src*="project-mark.svg"],img[src*="interactive-studio-icon.svg"]').forEach(img => {
      const isTabLike = img.closest("link[rel~='icon']") || /favicon|tablogo/i.test(img.alt || "");
      const target = base + (isTabLike ? "newp.png" : "newp-nobg.png");
      if (!img.src.endsWith(isTabLike ? "newp.png" : "newp-nobg.png")) img.src = target;
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
    }))).observe(document.documentElement, {childList:true,subtree:true});
  } catch (_) {}

  // Light mode is the platform-wide default and is intentionally not user-toggleable.
  function enforceLightAppearance() {
    const root = document.documentElement;
    if (root.dataset.theme !== "light") root.dataset.theme = "light";
    if (root.style.colorScheme !== "light") root.style.colorScheme = "light";
    try { if (localStorage.getItem("is-theme") !== "light") localStorage.setItem("is-theme", "light"); } catch (_) {}
  }
  enforceLightAppearance();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforceLightAppearance, { once: true });
  }
  // Prevent older page scripts or stored preferences from re-applying dark mode.
  try {
    new MutationObserver(enforceLightAppearance).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "style"]
    });
  } catch (_) {}
  window.addEventListener("storage", event => {
    if (event.key === "is-theme" && event.newValue !== "light") enforceLightAppearance();
  });
})();
