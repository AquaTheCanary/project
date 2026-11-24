import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".github", "_site", "node_modules"]);
const htmlFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(join(dir, entry.name));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      htmlFiles.push(join(dir, entry.name));
    }
  }
}

walk(root);
const failures = [];
let scriptsChecked = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let scriptNumber = 0;
  while ((match = scriptTag.exec(html))) {
    const attrs = match[1] || "";
    const source = match[2].trim();
    if (!source || /\bsrc\s*=/.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || "text/javascript";
    if (!["text/javascript", "application/javascript"].includes(type.toLowerCase())) continue;
    scriptNumber++;
    scriptsChecked++;
    try {
      new Function(source);
    } catch (error) {
      failures.push(relative(root, file) + " inline script " + scriptNumber + ": " + error.message);
    }
  }
}

try {
  JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
} catch (error) {
  failures.push("vercel.json: " + error.message);
}

const read = path => readFileSync(join(root, path), "utf8");
const required = [
  ["forms/index.html", "snap.docs.map(d=>({...d.data(),id:d.id}))", "Forms must preserve Firestore document IDs."],
  ["canvas/index.html", "project-cloud.js", "Canvas must load cloud persistence."],
  ["ready/index.html", "project-cloud.js", "Ready must load cloud persistence."],
  ["present/editor/index.html", "project-cloud.js", "Present must load cloud persistence."],
  ["communities/design/index.html", "publicCopy", "Community detail must load a shared design before copying it."],
  ["assets/files/project-cloud.js", "shareCopy", "Project cloud persistence must support publishing a community copy."],
  ["communities/design/index.html", 'db.collection("forms").add', "Community imports must support Forms."],
  ["communities/design/index.html", 'db.collection("websites").doc(slug).set', "Community imports must support Sites."],
  ["assets/files/firestore.rules", "'forms', 'sites'", "Community sharing rules must allow Forms and Sites."],
  ["dashboard/index.html", "projectCloud.list", "The workspace must load cloud-saved projects."],
  ["home/index.html", "PROJECT IS FREE TO USE", "The refreshed public homepage announcement must be present."],
  ["dashboard/index.html", 'responses.where("formId","==",item.id).where("ownerUid","==",user.uid)', "Deleting a form must clean up its responses."],
  ["assets/files/firebase-rooms.js", 'appPath("/assets/files/auth-config.js")', "Live presentation auth loader must use the case-sensitive asset path."],
  ["assets/files/worker.js", '"https://www.convex-project.abrdns.com"', "Worker CORS must allow the active Project origin."],
  ["websites/index.html", 'PLATFORM="www.convex-project.abrdns.com"', "Published Sites must use the canonical CNAME host."],
  ["assets/files/render-proxy/server.js", 'location: "https://www.convex-project.abrdns.com"', "The legacy sites host must redirect to the current Project domain."],
  ["assets/files/firestore.rules", "allow list: if false;", "Private presentation rooms must not be enumerable."]
];
for (const [path, needle, message] of required) {
  if (!read(path).includes(needle)) failures.push(path + ": " + message);
}

const appHtmlFiles = htmlFiles.filter(file => relative(root, file) !== "assets/files/published-sites-static/index.html");
for (const file of appHtmlFiles) {
  const html = readFileSync(file, "utf8");
  const path = relative(root, file);
  if (!html.includes("project-reference-ui.css?v=20261124-8")) failures.push(path + ": missing canonical screenshot reference stylesheet.");
  if (/(?:design-system|production-ui|studio-polish|product-quality|product-experience|product-studio-interfaces)\.css/.test(html)) failures.push(path + ": competing legacy stylesheet remains.");
  if (/theme-toggle|pref-theme|project_theme|data-theme=["']dark/i.test(html)) failures.push(path + ": obsolete appearance toggle remains.");
}
for (const path of ["assets/files/style.css", "assets/files/project-reference-ui.css"]) {
  const css = read(path);
  if (/theme-toggle|data-theme=["']dark/i.test(css)) failures.push(path + ": obsolete dark/light theme CSS remains.");
}

for (const path of ["assets/files/auth-config.js", "assets/files/auth-guard.js", "assets/files/project-cloud.js", "assets/files/firebase-rooms.js", "assets/files/render-proxy/server.js"]) {
  try { new Function(read(path)); } catch (error) { failures.push(path + ": " + error.message); }
}
try { new Function(read("assets/files/worker.js").replace("export default", "const worker =") + "; return worker;"); }
catch (error) { failures.push("assets/files/worker.js: " + error.message); }

const routerSource = read("assets/files/router.js");
if (!routerSource.includes("enforceReferenceTheme")) failures.push("assets/files/router.js: canonical reference theme loader is missing.");
if (!routerSource.includes("project-reference-ui.css?v=20261124-8")) failures.push("assets/files/router.js: canonical reference stylesheet version is stale.");
for (const destination of ["/auth/personal/login/", "/auth/organisation/login/", "/auth/personal/register/", "/auth/organisation/register/", "/forms/new/"]) {
  if (!routerSource.includes('"' + destination + '"')) failures.push("assets/files/router.js: missing valid route destination " + destination);
}
if (!read("register/index.html").includes('href="/register/personal/"')) failures.push("register/index.html: personal account chooser must use the public registration alias.");
if (!read("register/index.html").includes('href="/register/organisation/"')) failures.push("register/index.html: organisation account chooser must use the public registration alias.");
if (!read(".github/workflows/pages.yml").includes("cp register/index.html _site/register/index.html")) failures.push(".github/workflows/pages.yml: GitHub Pages must publish the styled registration chooser.");
if (read("help/index.html").includes("help.interactivestudio.abrdns.com")) failures.push("help/index.html: stale Help Centre redirect remains.");
for (const path of ["legal/privacy-policy/index.html", "legal/terms-of-service/index.html"]) {
  if (read(path).includes("assets/Files/design-system.css")) failures.push(path + ": case-sensitive stylesheet path is invalid.");
}

try {
  const fakeDocument = { readyState: "complete", querySelectorAll: () => [], documentElement: { querySelectorAll: () => [] } };
  const resolverFor = hostname => {
    const fakeWindow = {};
    new Function("window", "location", "document", "MutationObserver", read("assets/files/router.js"))(
      fakeWindow, { hostname }, fakeDocument, undefined
    );
    return fakeWindow.getAppUrl;
  };
  const vercelUrl = resolverFor("project.example").bind(null);
  const ghUrl = resolverFor("aquathecanary.github.io").bind(null);
  const routeChecks = [
    [vercelUrl, "/auth/personal/login/", "/auth/personal/login/"],
    [vercelUrl, "/login/personal/", "/auth/personal/login/"],
    [vercelUrl, "/websites/", "/websites/"],
    [vercelUrl, "/sites/", "/websites/"],
    [vercelUrl, "/forms/", "/forms/new/"],
    [ghUrl, "/auth/personal/login/", "/project/login/personal/"],
    [ghUrl, "/websites/", "/project/sites/"],
    [ghUrl, "/forms/", "/project/forms/new/"]
  ];
  for (const [resolve, input, expected] of routeChecks) {
    if (resolve(input) !== expected) failures.push("assets/files/router.js: route " + input + " should resolve to " + expected);
  }
} catch (error) {
  failures.push("assets/files/router.js route checks: " + error.message);
}

if (failures.length) {
  console.error("Project smoke checks failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log("Project smoke checks passed: " + appHtmlFiles.length + " app HTML pages, " + scriptsChecked + " inline scripts and canonical route checks.");
}
