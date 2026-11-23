// Shared protection for all authenticated workspace routes.
(function () {
  const current = location.pathname + location.search + location.hash;
  const safeReturn = current.startsWith("/") && !current.startsWith("//") && !current.startsWith("/auth/");
  const routePath = location.pathname.replace(window.APP_BASE_PATH || "", "") || "/";
  const product = routePath.startsWith("/canvas") ? "canvas" : routePath.startsWith("/ready") ? "ready" : (routePath.startsWith("/sites")||routePath.startsWith("/websites")) ? "sites" : routePath.startsWith("/forms") ? "forms" : routePath.startsWith("/present")||routePath.startsWith("/presentation") ? "present" : null;
  const guestMode = new URLSearchParams(location.search).get("guest") === "1";
  document.documentElement.style.visibility = "hidden";
  const goToLogin = () => {
    if (safeReturn) {
      try { sessionStorage.setItem("studio_return_to", current); } catch (_) {}
    }
    const login = (window.getAppUrl ? window.getAppUrl("/login/") : "/login/");
    location.replace(login);
  };
  const authCheck = Promise.resolve(window.studioAuth && studioAuth.currentUser());
  const fallback = new Promise(resolve => setTimeout(() => resolve("__auth_timeout__"), 10000));
  Promise.race([authCheck, fallback])
    .then(async user => {
      if (user === "__auth_timeout__") {
        console.error("Workspace auth check timed out. Showing recovery UI instead of leaving the page blank.");
        document.documentElement.style.visibility = "";
        document.documentElement.dataset.authCheckTimeout = "true";
        return;
      }
      if (!user) {
        if (guestMode && product) {
          window.PROJECT_GUEST_MODE = true;
          document.documentElement.style.visibility = "";
          document.documentElement.dataset.guest = "true";
          const productNames={canvas:"Product Canvas",ready:"Project Ready",sites:"Project Sites",forms:"Project Forms",present:"Project Present"};
          const banner=()=>{if(document.getElementById("project-guest-banner"))return;const el=document.createElement("div");el.id="project-guest-banner";el.style.cssText="position:relative;z-index:9999;padding:12px 18px;background:#fff4d9;color:#654b10;font:12px/1.5 system-ui,sans-serif;border-bottom:1px solid #f0dca8";el.append(document.createTextNode("Welcome to "+productNames[product]+"! Keep in mind you’re in the guest version, so you can’t save or share your projects. "));const create=document.createElement("a");create.href=window.getAppUrl?window.getAppUrl("/register/"):"/register/";create.textContent="Create an account";create.style.cssText="font-weight:700;color:inherit";el.append(create,document.createTextNode(" or "));const login=document.createElement("a");login.href=window.getAppUrl?window.getAppUrl("/login/"):"/login/";login.textContent="sign in";login.style.cssText="font-weight:700;color:inherit";el.append(login,document.createTextNode(" to access these features."));document.body.prepend(el);};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",banner,{once:true});else banner();
          try{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(/studio_deck_|project_canvas|project_ready|project_form|project_site|studio_projects_|canvas_cloud_project_|ready_cloud_project_/i.test(String(k)))return;return original.call(this,k,v)}}catch(_){}
          return;
        }
        if(product){const guestPath="/guest/"+product+"/";location.replace(window.getAppUrl?window.getAppUrl(guestPath):guestPath);return;}
        goToLogin(); return;
      }
      const accountType = window.studioAuth && studioAuth.getAccountType
        ? await studioAuth.getAccountType(user) : null;
      if (accountType !== "personal" && accountType !== "organisation") {
        goToLogin();
        return;
      }
      document.documentElement.style.visibility = "";
      document.documentElement.dataset.authenticated = "true";
      document.documentElement.dataset.accountType = accountType;
    })
    .catch(error => {
      console.error("Workspace authentication check failed:", error);
      goToLogin();
    });
})();
