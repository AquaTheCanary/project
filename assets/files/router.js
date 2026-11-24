// Project canonical URL resolver.
(function () {
  "use strict";
  const isGitHubPages = location.hostname.toLowerCase().endsWith(".github.io");
  const repositoryBase = isGitHubPages ? "/project" : "";
  window.APP_BASE_PATH = repositoryBase;
  const routeMap = [
    [/^\/home\/?$/, "/"],
    [/^\/auth\/personal\/login\/?$/, isGitHubPages ? "/login/personal/" : "/auth/personal/login/"],
    [/^\/auth\/organisation\/login\/?$/, isGitHubPages ? "/login/organisation/" : "/auth/organisation/login/"],
    [/^\/auth\/personal\/register\/?$/, isGitHubPages ? "/register/personal/" : "/auth/personal/register/"],
    [/^\/auth\/organisation\/register\/?$/, isGitHubPages ? "/register/organisation/" : "/auth/organisation/register/"],
    [/^\/login\/personal\/?$/, isGitHubPages ? "/login/personal/" : "/auth/personal/login/"],
    [/^\/login\/organisation\/?$/, isGitHubPages ? "/login/organisation/" : "/auth/organisation/login/"],
    [/^\/register\/personal\/?$/, isGitHubPages ? "/register/personal/" : "/auth/personal/register/"],
    [/^\/register\/organisation\/?$/, isGitHubPages ? "/register/organisation/" : "/auth/organisation/register/"],
    [/^\/websites\/?$/, isGitHubPages ? "/sites/" : "/websites/"],
    [/^\/websites\/new\/?$/, "/sites/new/"],
    [/^\/websites\/editor\/?$/, "/sites/new/"],
    [/^\/sites\/new\/?$/, "/sites/new/"],
    [/^\/sites\/?$/, isGitHubPages ? "/sites/" : "/websites/"],
    [/^\/presentation\/?$/, "/present/"],
    [/^\/presentation\/new\/?$/, "/present/new/"],
    [/^\/presentations\/?$/, "/present/new/"],
    [/^\/presentations\/new\/?$/, "/present/new/"],
    [/^\/presentations\/editor\/?$/, "/present/"],
    [/^\/forms\/?$/, "/forms/new/"],
    [/^\/forms\/new\/?$/, "/forms/new/"]
  ]; window.getAppUrl = function (path) {
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

  // One canonical screenshot-led UI stylesheet. Remove legacy layers that were
  // competing with each other and append the reference layer after page styles.
  function enforceReferenceTheme() {
    if (!document || !document.head || !document.querySelectorAll || !document.createElement) return;
    const appRoute = /^\/(?:project\/)?(dashboard|canvas|ready|present|forms|websites|sites|communities|settings|profile|account|admin|login|register|auth)(?:\/|$)/i.test(location.pathname);
    if (appRoute && document.body) document.body.classList.add("project-app-fullscreen");
    const legacy = /(?:design-system|production-ui|product-quality|product-experience|studio-polish)\.css(?:[?#]|$)/i;
    document.querySelectorAll('link[rel~="stylesheet"]').forEach(link => {
      if (legacy.test(link.href || "")) link.remove();
    });
    const href = window.getAppUrl("/assets/files/project-reference-ui.css?v=20261124-6");
    let link = document.querySelector('link[data-project-reference-theme]');
    if (!link) {
      link = document.querySelector('link[rel~="stylesheet"][href*="project-reference-ui.css"]');
    }
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.dataset.projectReferenceTheme = "true";
    if (link.href !== new URL(href, location.href).href) link.href = href;
    // Keep it last in the cascade so inline legacy page CSS cannot fragment
    // the shared shell. Product layout rules remain product-specific.
    document.head.appendChild(link);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enforceReferenceTheme);
  else enforceReferenceTheme();
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

})();
