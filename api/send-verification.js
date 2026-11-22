import { createSign } from "node:crypto";

const ALLOWED_ORIGINS = new Set([
  "https://convex-project.abrdns.com",
  "https://www.convex-project.abrdns.com",
  "https://interactivestudio.abrdns.com",
  "https://aquathecanary.github.io"
]);

function sendJson(res, status, body, origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://convex-project.abrdns.com";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}
const b64url = value => Buffer.from(value).toString("base64url");

async function googleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claims;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(serviceAccount.private_key).toString("base64url");
  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Firebase service account could not obtain an access token.");
  return data.access_token;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (req.method === "OPTIONS") return sendJson(res, 204, {}, origin);
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." }, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return sendJson(res, 403, { error: "Origin not allowed." }, origin);

  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || "convexllc-project";
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appOrigin = (process.env.APP_ORIGIN || "https://convex-project.abrdns.com").replace(/\/$/, "");
  let serviceAccount;
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"); }
  catch (_) { return sendJson(res, 500, { error: "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON." }, origin); }
  if (!apiKey || !resendKey || !from || !serviceAccount.client_email || !serviceAccount.private_key) {
    return sendJson(res, 500, { error: "Vercel email verification is not configured. Add FIREBASE_API_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, RESEND_API_KEY and EMAIL_FROM." }, origin);
  }

  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return sendJson(res, 401, { error: "Sign in before requesting verification." }, origin);
  try {
    const idToken = authorization.slice(7);
    const lookup = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    const accountData = await lookup.json().catch(() => ({}));
    const account = accountData.users && accountData.users[0];
    if (!lookup.ok || !account) return sendJson(res, 401, { error: "Your sign-in session has expired. Sign in again." }, origin);
    if (account.emailVerified) return sendJson(res, 200, { ok: true, alreadyVerified: true }, origin);
    if (!account.email) return sendJson(res, 400, { error: "This account does not have an email address to verify." }, origin);

    const accessToken = await googleAccessToken(serviceAccount);
    const continueUrl = appOrigin + "/auth/action/";
    const generated = await fetch("https://identitytoolkit.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/accounts:sendOobCode", {
      method: "POST",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "VERIFY_EMAIL",
        email: account.email,
        returnOobLink: true,
        continueUrl,
        canHandleCodeInApp: false
      })
    });
    const linkData = await generated.json().catch(() => ({}));
    if (!generated.ok || !linkData.oobLink) {
      console.error("Firebase verification-link generation failed:", linkData.error || generated.status);
      return sendJson(res, 502, { error: "Firebase could not create a verification link. Check the service account's Firebase Authentication permissions." }, origin);
    }
    const firebaseLink = new URL(linkData.oobLink);
    const code = firebaseLink.searchParams.get("oobCode");
    if (!code) return sendJson(res, 502, { error: "Firebase returned an incomplete verification link." }, origin);
    const actionUrl = appOrigin + "/auth/action/?mode=verifyEmail&oobCode=" + encodeURIComponent(code) + "&continueUrl=" + encodeURIComponent(appOrigin + "/auth/personal/login/");

    const name = escapeHtml(account.displayName || account.email.split("@")[0] || "there");
    const emailHtml = `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:Arial,sans-serif;color:#252638;padding:36px 16px"><table role="presentation" style="width:100%;max-width:560px;margin:auto;background:#fff;border:1px solid #e7e8ef;border-radius:16px;overflow:hidden"><tr><td style="padding:34px 36px 12px"><div style="font-size:22px;font-weight:800;letter-spacing:-.7px;color:#252638">Project<span style="color:#635bff">.</span></div><p style="margin:30px 0 8px;color:#635bff;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">ACCOUNT SECURITY</p><h1 style="font-size:27px;line-height:1.2;letter-spacing:-.8px;margin:0 0 14px">Verify your email address</h1><p style="font-size:15px;line-height:1.7;color:#666d7d">Hi ${name},</p><p style="font-size:15px;line-height:1.7;color:#666d7d">Thanks for creating your Project account. Confirm your email address to finish setting up your account and keep your workspace secure.</p><p style="margin:28px 0"><a href="${actionUrl}" style="display:inline-block;padding:14px 22px;border-radius:9px;background:#635bff;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Verify email address</a></p><p style="font-size:12px;line-height:1.7;color:#818797">If the button does not work, copy and paste this link into your browser:<br><a href="${actionUrl}" style="color:#635bff;word-break:break-all">${actionUrl}</a></p><p style="font-size:12px;line-height:1.7;color:#818797;margin-top:26px">If you did not create a Project account, you can safely ignore this email.</p></td></tr><tr><td style="padding:18px 36px;background:#fafaff;border-top:1px solid #ececf3;color:#9297a5;font-size:11px">Project · Create with clarity. Share with confidence.</td></tr></table></body></html>`;
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [account.email],
        subject: "Verify your email address",
        html: emailHtml,
        text: "Hi " + (account.displayName || "there") + ",\n\nVerify your Project email address using this link:\n" + actionUrl + "\n\nIf you did not create this account, you can ignore this email."
      })
    });
    const sentData = await sent.json().catch(() => ({}));
    if (!sent.ok) {
      console.error("Resend delivery failed:", sentData);
      return sendJson(res, 502, { error: "The verification link was created, but the email provider could not send it. Check the Resend sender and API key." }, origin);
    }
    return sendJson(res, 200, { ok: true, email: account.email }, origin);
  } catch (error) {
    console.error("Verification email request failed:", error);
    return sendJson(res, 502, { error: error.message || "The email verification service is temporarily unavailable." }, origin);
  }
}
