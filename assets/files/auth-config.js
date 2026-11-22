// Project authentication shared by every product account page.
// Google, GitHub and email/password are the supported sign-in methods.
// Each product has its own Firebase Web App registration in the shared
// convexllc-project Firebase project. Authentication and Firestore data remain
// shared at project level; appId identifies the specific web app.
const firebaseApps = {
  formr: {
    apiKey: "AIzaSyAU1ClFXmG9z2q4vjhrsCgcJVNJFq1Ubj0",
    authDomain: "convexllc-project.firebaseapp.com",
    projectId: "convexllc-project",
    storageBucket: "convexllc-project.firebasestorage.app",
    messagingSenderId: "82355515745",
    appId: "1:82355515745:web:f7c14659f4a6aab0c89520"
  },
  siteify: {
    apiKey: "AIzaSyAU1ClFXmG9z2q4vjhrsCgcJVNJFq1Ubj0",
    authDomain: "convexllc-project.firebaseapp.com",
    projectId: "convexllc-project",
    storageBucket: "convexllc-project.firebasestorage.app",
    messagingSenderId: "82355515745",
    appId: "1:82355515745:web:ccce127331752422c89520"
  },
  presentr: {
    apiKey: "AIzaSyAU1ClFXmG9z2q4vjhrsCgcJVNJFq1Ubj0",
    authDomain: "convexllc-project.firebaseapp.com",
    projectId: "convexllc-project",
    storageBucket: "convexllc-project.firebasestorage.app",
    messagingSenderId: "82355515745",
    appId: "1:82355515745:web:688a127209384981c89520"
  }
};
const firebaseHost = window.location.hostname.toLowerCase();
const firebasePath = window.location.pathname.toLowerCase();
const firebaseProduct = firebaseHost.includes("formr") || firebasePath.startsWith("/forms/") ? "formr"
  : firebaseHost.includes("siteify") || firebasePath.startsWith("/sites/") ? "siteify"
  : firebaseHost.includes("presentr") || (firebasePath.startsWith("/present/") || firebasePath.startsWith("/present/")) ? "presentr" : null;
const firebaseConfig = firebaseProduct ? firebaseApps[firebaseProduct] : {
  // Keep Firebase Auth's helper iframe and redirect handler on the Project origin.
  // The Cloudflare Worker proxies /__/ requests to Firebase Hosting so browser
  // storage remains first-party throughout the OAuth redirect.
  apiKey: "AIzaSyAU1ClFXmG9z2q4vjhrsCgcJVNJFq1Ubj0",
  authDomain: "convexllc-project.firebaseapp.com",
  projectId: "convexllc-project",
  storageBucket: "convexllc-project.firebasestorage.app",
  messagingSenderId: "82355515745",
  appId: "1:82355515745:web:e839271f484f1a5cc89520"
};
if (!window.firebase) throw new Error("Load Firebase App and Auth compat SDK before auth-config.js.");
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

(function () {
  const auth = firebase.auth();
  const freeDomains = new Set([
    "gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","ymail.com",
    "hotmail.com","hotmail.co.uk","outlook.com","outlook.co.uk","live.com",
    "live.co.uk","msn.com","icloud.com","me.com","mac.com","aol.com",
    "mail.com","proton.me","protonmail.com","gmx.com","gmx.co.uk",
    "yandex.com","hey.com","fastmail.com","pm.me","zoho.com"
  ]);
  const paidPlans = new Set(); // No paid tiers: every feature is included in the free plan.
  const appUrl = path => window.getAppUrl ? window.getAppUrl(path) : path;
  // Set durable browser persistence before resolving the initial auth state.
  // This prevents page guards from briefly treating a returning user as signed out.
  const authReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => { console.error("Firebase persistence setup failed:", error); })
    .then(() => Promise.race([
      new Promise(resolve => {
        let unsubscribe = () => {};
        unsubscribe = auth.onAuthStateChanged(user => { unsubscribe(); resolve(user || null); },
          error => { unsubscribe(); console.error("Firebase auth state error:", error); resolve(auth.currentUser || null); });
      }),
      new Promise(resolve => setTimeout(() => {
        console.warn("Firebase auth state was slow; continuing with the current session snapshot.");
        resolve(auth.currentUser || null);
      }, 8000))
    ]));

  // Firebase LOCAL persistence keeps the account signed in across navigation,
  // tab closure and browser restarts. Only the explicit Sign out action clears it.
  const SESSION_KEY = "interactive_studio_session_v4";
  let sessionEnding = false;
  function beginFreshSession() {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: auth.currentUser?.uid || null, createdAt: Date.now() })); } catch (_) {}
  }
  function startSessionLifecycle(user) {
    if (!user) return;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: user.uid, createdAt: Date.now() })); } catch (_) {}
  }

  const studioAuth = {
    auth,
    ready: authReady,
    freeDomains,
    paidPlans,
    isOrganisationEmail(email) {
      const value = String(email || "").trim().toLowerCase();
      const at = value.lastIndexOf("@");
      if (at < 1) return false;
      const domain = value.slice(at + 1);
      return domain.includes(".") && !freeDomains.has(domain) &&
        !domain.startsWith(".") && !domain.endsWith(".");
    },
    async currentUser() {
      await authReady;
      if (studioAuth.redirectReady) await studioAuth.redirectReady;
      return auth.currentUser;
    },
    async refreshEmailVerification(user) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) return false;
      // Refresh both the Firebase user record and its ID token. The emailVerified
      // property on an already-loaded client session can otherwise remain stale.
      // Always reload the actual Firebase Auth session, then force a fresh
      // token. The token's email_verified claim is the server-issued source
      // of truth and avoids relying on a stale User object after action-code use.
      const sessionUser = auth.currentUser || activeUser;
      await sessionUser.reload();
      const liveUser = auth.currentUser || sessionUser;
      const tokenResult = await liveUser.getIdTokenResult(true);
      return tokenResult.claims.email_verified === true || !!liveUser.emailVerified;
    },
    async getAccountRecord(user) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) return null;
      if (!firebase.firestore) throw new Error("The account database could not be loaded. Refresh and try again.");
      const snapshot = await firebase.firestore().collection("userProfiles").doc(activeUser.uid).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    async getAccountType(user) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) return null;
      // A previously authenticated browser already has a UID-bound account-type
      // cache written by finishSignIn(). Use it if Firestore is temporarily
      // unavailable (for example, rules have not propagated yet). Never use a
      // cached type for a different Firebase UID.
      const cachedType = localStorage.getItem("is_user_uid") === activeUser.uid
        ? localStorage.getItem("is_user_account_type") : null;
      try {
        const record = await studioAuth.getAccountRecord(activeUser);
        if (record && (record.accountType === "personal" || record.accountType === "organisation")) {
          localStorage.setItem("is_user_uid", activeUser.uid);
          localStorage.setItem("is_user_account_type", record.accountType);
          return record.accountType;
        }
        if (cachedType === "personal" || cachedType === "organisation") return cachedType;
        return null;
      } catch (error) {
        console.warn("Firestore account-type lookup failed; checking this browser's UID-bound session cache.", error);
        if (cachedType === "personal" || cachedType === "organisation") return cachedType;
        throw error;
      }
    },
    async resolveAccountType(user, requestedType) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) throw new Error("Sign in before checking your account.");
      const type = requestedType === true || requestedType === "organisation" ? "organisation" : "personal";
      const ref = firebase.firestore().collection("userProfiles").doc(activeUser.uid);
      const snapshot = await ref.get();
      const record = snapshot.exists ? snapshot.data() : {};
      const existing = record.accountType;
      if (existing && existing !== type) {
        throw new Error(existing === "organisation"
          ? "This email belongs to an organisation account. Please use Organisation sign in."
          : "This email belongs to a personal account. Please use Personal sign in.");
      }
      if (type === "organisation") await studioAuth.validateOrganisation(activeUser);
      if (!existing) {
        await ref.set({
          uid: activeUser.uid,
          email: activeUser.email || "",
          displayName: activeUser.displayName || "",
          accountType: type,
          accountTypeCreatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        await ref.set({
          email: activeUser.email || "",
          displayName: activeUser.displayName || "",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      return type;
    },
    async getProfile(user) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) return null;
      try { await studioAuth.refreshEmailVerification(activeUser); } catch (error) { console.warn("Could not refresh Firebase account status:", error); }
      const refreshedUser = auth.currentUser || activeUser;
      let claims = {};
      try { claims = (await refreshedUser.getIdTokenResult(true)).claims || {}; } catch (_) {}
      let record = {};
      try { record = await studioAuth.getAccountRecord(refreshedUser) || {}; } catch (error) { console.warn("Account profile lookup failed:", error); }
      return {
        uid: refreshedUser.uid,
        email: refreshedUser.email || "",
        name: refreshedUser.displayName || record.displayName || refreshedUser.email || "Creator",
        photoURL: refreshedUser.photoURL || record.photoURL || "",
        emailVerified: claims.email_verified === true || !!refreshedUser.emailVerified,
        provider: refreshedUser.providerData?.[0]?.providerId || "password",
        plan: "Free",
        accountType: record.accountType || (localStorage.getItem("is_user_uid") === refreshedUser.uid ? localStorage.getItem("is_user_account_type") : null),
        organisationId: claims.organisationId || record.organisationId || null
      };
    },
    async routeAuthenticatedUser(expectedType) {
      await studioAuth.currentUser();
      const user = auth.currentUser;
      if (!user) return false;
      await studioAuth.refreshEmailVerification(user);
      const live = auth.currentUser || user;
      if (!live.emailVerified) return false;
      const accountType = await studioAuth.getAccountType(live);
      if (accountType !== expectedType) return false;
      window.location.replace(appUrl("/dashboard/"));
      return true;
    },
    async requireUser(redirect = "/auth/personal/login/") {
      const user = await studioAuth.currentUser();
      if (!user) {
        window.location.replace(appUrl(redirect));
        return null;
      }
      return user;
    },
    async validateOrganisation(user) {
      if (!user || !studioAuth.isOrganisationEmail(user.email)) {
        throw new Error("Use a verified corporate email address. Consumer email providers are not accepted for organisation accounts.");
      }
      if (!user.emailVerified) {
        throw new Error("Verify your corporate email address before accessing an organisation workspace.");
      }
      const token = await user.getIdToken();
      const response = await fetch("https://interactive-studio.convexllc.workers.dev/assertOrganisationAccess", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Organisation verification failed.");
      return true;
    },
    async finishSignIn(user, organisation = false) {
      let accountType;
      try { accountType = await studioAuth.resolveAccountType(user, organisation ? "organisation" : "personal"); }
      catch (error) { await auth.signOut(); throw error; }
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: user.uid, createdAt: Date.now() })); } catch (_) {}
      const profile = await studioAuth.getProfile(user);
      localStorage.setItem("is_user_uid", profile.uid);
      localStorage.setItem("is_user_email", profile.email);
      localStorage.setItem("is_user_name", profile.name);
      localStorage.setItem("is_user_photo", profile.photoURL);
      localStorage.setItem("is_user_plan", profile.plan);
      localStorage.setItem("is_user_provider", profile.provider);
      localStorage.setItem("is_user_account_type", accountType);
      const requested = sessionStorage.getItem("studio_return_to") || "";
      sessionStorage.removeItem("studio_return_to");
      const basePath = window.APP_BASE_PATH || "";
      const route = basePath && requested.startsWith(basePath + "/") ? requested.slice(basePath.length) : requested;
      const destination = route.startsWith("/") && !route.startsWith("//") && !route.startsWith("/auth/")
        ? route : "/dashboard/";
      window.location.replace(appUrl(destination));
    },
    async signInEmail(email, password, organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      if (organisation && !studioAuth.isOrganisationEmail(email)) {
        throw new Error("Organisation login requires a corporate email domain. Gmail, Yahoo, Outlook.com and other personal providers are blocked.");
      }
      beginFreshSession();
      const credential = await auth.signInWithEmailAndPassword(email.trim(), password);
      await studioAuth.refreshEmailVerification(credential.user);
      const refreshedUser = auth.currentUser || credential.user;
      if (!refreshedUser.emailVerified) {
        let sendError = null;
        try { await studioAuth.sendVerificationEmail(refreshedUser); } catch (error) { sendError = error; }
        await auth.signOut();
        if (sendError) throw new Error("Your email is not verified, and the verification email could not be sent: " + sendError.message);
        throw new Error(organisation
          ? "Your work email is not verified yet. We sent a fresh verification link. Verify it, then sign in again."
          : "Your email is not verified yet. We sent a fresh verification link. Verify it, then sign in again.");
      }
      await studioAuth.finishSignIn(refreshedUser, organisation);
    },
    async completeRedirectSignIn() {
      await authReady;
      // Always consume Firebase's redirect result. On mobile browsers and
      // cross-domain auth handlers, sessionStorage can be unavailable or the
      // pending marker can be lost even though Firebase has a valid callback.
      // getRedirectResult() is safe on ordinary page loads and returns null
      // when this page was not reached through an OAuth redirect.
      const pendingOrganisation = localStorage.getItem("studio_sso_account_type");
      try {
        const credential = await auth.getRedirectResult();
        const redirectUser = (credential && credential.user) || null;
        // A real redirect credential is authoritative, even if the
        // sessionStorage marker did not survive the provider round-trip.
        // If Firebase only restored an existing session, do not re-run
        // finishSignIn() on every page load.
        const user = redirectUser || (pendingOrganisation !== null ? auth.currentUser : null);
        if (!user) {
          if (pendingOrganisation !== null) localStorage.removeItem("studio_sso_account_type");
          return false;
        }
        localStorage.removeItem("studio_sso_account_type");
        await studioAuth.finishSignIn(user, pendingOrganisation === "organisation");
        return true;
      } catch (error) {
        localStorage.removeItem("studio_sso_account_type");
        showAuthError(error);
        console.error("Firebase OAuth redirect completion failed:", error);
        return false;
      }
    },
    async signInGoogle(organisation = false) {
      // LOCAL persistence is configured during shared auth initialisation.
      // Do not await another persistence write here: preserve the click's
      // transient user activation so mobile browsers allow the popup.
      beginFreshSession();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      // Complete Google authentication in the current tab. This avoids the
      // cross-domain redirect hand-off that can silently lose the Firebase
      // credential on mobile browsers when third-party storage is restricted.
      const credential = await auth.signInWithPopup(provider);
      if (!credential || !credential.user) throw new Error("Google sign-in completed without returning an account. Please try again.");
      await studioAuth.finishSignIn(credential.user, organisation);
    },
    async signInGithub(organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      beginFreshSession();
      const provider = new firebase.auth.GithubAuthProvider();
      provider.addScope("user:email");
      localStorage.setItem("studio_sso_account_type", organisation ? "organisation" : "personal");
      await auth.signInWithRedirect(provider);
    },
    async signInTwitter(organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      beginFreshSession();
      // Use redirect for X on mobile browsers: popup windows are commonly
      // blocked after Firebase persistence has completed asynchronously.
      const provider = new firebase.auth.TwitterAuthProvider();
      localStorage.setItem("studio_sso_account_type", organisation ? "organisation" : "personal");
      await auth.signInWithRedirect(provider);
    },
    async signInMicrosoft(organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      beginFreshSession();
      const provider = new firebase.auth.OAuthProvider("microsoft.com");
      provider.setCustomParameters({ prompt: "select_account" });
      provider.addScope("email");
      provider.addScope("profile");
      localStorage.setItem("studio_sso_account_type", organisation ? "organisation" : "personal");
      await auth.signInWithRedirect(provider);
    },
    async runSSO(provider, organisation) {
      try {
        const credential = await auth.signInWithPopup(provider);
        await studioAuth.finishSignIn(credential.user, organisation);
      } catch (error) {
        const redirectCodes = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"];
        if (redirectCodes.includes(error.code)) {
          localStorage.setItem("studio_sso_account_type", organisation ? "organisation" : "personal");
          await auth.signInWithRedirect(provider);
          return;
        }
        throw error;
      }
    },
    async sendVerificationEmail(user) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) throw new Error("Sign in before requesting a verification email.");
      try {
        const token = await activeUser.getIdToken(true);
        const response = await fetch("https://convexllc-project.vercel.app/api/send-verification", {
          method: "POST",
          headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
          body: "{}"
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.error || "The custom verification email could not be sent.");
        return true;
      } catch (customError) {
        // Keep account creation and verification usable while the custom Vercel
        // sender is being configured. Firebase's built-in template is the fallback.
        console.warn("Custom email sender unavailable; using Firebase's default verification email.", customError);
        const returnUrl = window.location.origin + appUrl("/auth/personal/login/");
        await activeUser.sendEmailVerification({ url: returnUrl, handleCodeInApp: false });
        return true;
      }
    },
    async resetPassword(email) {
      if (!email) throw new Error("Enter your email address first.");
      await auth.sendPasswordResetEmail(email.trim());
    },
    async registerOrganisation({ name, email, password }) {
      if (!studioAuth.isOrganisationEmail(email)) throw new Error("Use a corporate email address to register an organisation account.");
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const credential = await auth.createUserWithEmailAndPassword(email.trim(), password);
      try {
        await credential.user.updateProfile({ displayName: name.trim() });
        await firebase.firestore().collection("userProfiles").doc(credential.user.uid).set({
          uid: credential.user.uid, email: credential.user.email || email.trim(), displayName: name.trim(),
          accountType: "organisation", createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await studioAuth.sendVerificationEmail(credential.user);
      } finally { await auth.signOut(); }
      return true;
    },
    async registerPersonal({ name, email, password }) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const credential = await auth.createUserWithEmailAndPassword(email.trim(), password);
      try {
        await credential.user.updateProfile({ displayName: name.trim() });
        await firebase.firestore().collection("userProfiles").doc(credential.user.uid).set({
          uid: credential.user.uid, email: credential.user.email || email.trim(), displayName: name.trim(),
          accountType: "personal", createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await studioAuth.sendVerificationEmail(credential.user);
      } finally { await auth.signOut(); }
      return true;
    },
    async signOut() {
      sessionEnding = true;
      await auth.signOut();
      ["is_user_uid","is_user_email","is_user_name","is_user_photo","is_user_plan","is_user_provider","is_user_account_type"].forEach(key => localStorage.removeItem(key));
      localStorage.removeItem("interactive_studio_session");
      localStorage.removeItem(SESSION_KEY);
      window.location.replace(appUrl("/home/"));
    }
  };

  // Resolve redirect-based SSO before page guards inspect the signed-in user.
  // Firebase LOCAL persistence survives navigation, reloads and browser restarts.
  studioAuth.redirectReady = Promise.resolve().then(() => studioAuth.completeRedirectSignIn());

  auth.onAuthStateChanged(user => { if (user) startSessionLifecycle(user); });

  window.studioAuth = studioAuth;
  let ssoInProgress = false;
  function runLoginSSO(method, organisation, button) {
    if (ssoInProgress) return Promise.resolve();
    ssoInProgress = true;
    const buttons = Array.from(document.querySelectorAll(".btn-sso"));
    const emailButton = document.querySelector(".auth-form .btn-submit");
    const originals = new Map(buttons.map(item => [item, item.innerHTML]));
    buttons.forEach(item => { item.disabled = true; item.classList.add("sso-disabled"); });
    if (emailButton) emailButton.disabled = true;
    if (button) {
      button.classList.remove("sso-disabled");
      button.classList.add("sso-active");
      button.innerHTML = '<span class="sso-spinner" aria-hidden="true"></span><span>Connecting…</span>';
    }
    if (!document.getElementById("sso-loading-styles")) {
      const style = document.createElement("style");
      style.id = "sso-loading-styles";
      style.textContent = '.btn-sso.sso-disabled{opacity:.42;filter:grayscale(1);cursor:not-allowed}.btn-sso.sso-active{opacity:1;filter:none;cursor:wait}.sso-spinner{width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;display:inline-block;animation:ssoSpin .7s linear infinite;vertical-align:middle}@keyframes ssoSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
    let attempt;
    try { attempt = method(!!organisation); }
    catch (error) { attempt = Promise.reject(error); }
    return Promise.resolve(attempt).catch(error => {
      ssoInProgress = false;
      buttons.forEach(item => { item.disabled = false; item.classList.remove("sso-disabled","sso-active"); item.innerHTML = originals.get(item); });
      if (emailButton) emailButton.disabled = false;
      showAuthError(error);
    });
  }
  window.loginWithGoogle = (organisation, button) => runLoginSSO(studioAuth.signInGoogle, organisation, button);
  window.loginWithGithub = (organisation, button) => runLoginSSO(studioAuth.signInGithub, organisation, button);
  window.loginWithMicrosoft = (organisation, button) => runLoginSSO(studioAuth.signInMicrosoft, organisation, button);
  window.loginWithTwitter = (organisation, button) => runLoginSSO(studioAuth.signInTwitter, organisation, button);
  window.showAuthError = showAuthError;
  function showAuthError(error) {
    const messages = {
      "auth/api-key-not-valid": "This app is using an invalid Firebase API key. Refresh the page after the Firebase configuration has been updated, and check the Browser key in Google Cloud Console if the error continues.",
      "auth/unauthorized-domain": "This website domain is not authorised in Firebase. Add convex-project.abrdns.com under Firebase Authentication → Settings → Authorised domains.",
      "auth/operation-not-allowed": "This sign-in provider is not enabled yet. Enable X (Twitter) in Firebase Authentication → Sign-in providers, then add your X API Key and API Key Secret.",
      "auth/invalid-oauth-client-id": "The social sign-in provider is not configured correctly. Check its App/Client ID in Firebase Authentication → Sign-in providers.",
      "auth/invalid-oauth-provider": "The social sign-in provider is not enabled in Firebase Authentication. Enable the provider and save its credentials.",
      "auth/missing-email": "GitHub did not share an email address. Make your email visible to the GitHub OAuth app, then try again.",
      "auth/popup-closed-by-user": "The sign-in window was closed before sign-in finished. Please try again.",
      "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
      "auth/network-request-failed": "A network error interrupted sign-in. Check your connection and try again.",
      "auth/account-exists-with-different-credential": "An account already exists with this email using another sign-in method. Sign in with that method first.",
      "permission-denied": "Project could not save or read your account type. Check the Firestore userProfiles rules and try again.",
      "unavailable": "The account database is temporarily unavailable. Check your connection and try again."
    };
    const detail = messages[error && error.code] || (error && error.message) || "Something went wrong. Please try again.";
    const message = document.querySelector("[data-auth-message]");
    if (message) {
      message.textContent = detail;
      message.className = "auth-message error";
    } else {
      console.error(error);
      window.alert(detail);
    }
  }
})();
