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
  ["communities/design/index.html", "shareCopy", "Community imports must support copying shared projects."],
  ["assets/files/firestore.rules", "'forms', 'sites'", "Community sharing rules must allow Forms and Sites."],
  ["dashboard/index.html", "projectCloud.list", "The workspace must load cloud-saved projects."],
  ["dashboard/index.html", 'responses.where("formId","==",item.id).where("ownerUid","==",user.uid)', "Deleting a form must clean up its responses."],
  ["assets/files/firebase-rooms.js", 'appPath("/assets/files/auth-config.js")', "Live presentation auth loader must use the case-sensitive asset path."],
  ["assets/files/worker.js", '"https://www.convex-project.abrdns.com"', "Worker CORS must allow the active Project origin."],
  ["websites/index.html", 'PLATFORM="www.convex-project.abrdns.com"', "Published Sites must use the canonical CNAME host."],
  ["assets/files/firestore.rules", "allow list: if false;", "Private presentation rooms must not be enumerable."]
];
for (const [path, needle, message] of required) {
  if (!read(path).includes(needle)) failures.push(path + ": " + message);
}

if (failures.length) {
  console.error("Project smoke checks failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log("Project smoke checks passed: " + htmlFiles.length + " HTML pages and " + scriptsChecked + " inline scripts checked.");
}
