import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES_DIR = join(FRONTEND_ROOT, "src", "routes");
const COMPONENTS_DIR = join(FRONTEND_ROOT, "src", "components");

function routeSource(name) {
  return readFileSync(join(ROUTES_DIR, name), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whitespace- and quote-style-tolerant check for a route reference. Catches
 * plain hrefs, JSX expression hrefs and quoted route ids used by the router.
 */
function referencesRoute(source, routePath) {
  const compact = source
    .replace(/\s+/g, "")
    .replace(/`/g, '"')
    .replace(/'/g, '"');
  const bare = routePath.replace(/^\//, "");
  return new RegExp(`${escapeRegExp(`/${bare}`)}(?=["/>?#])`).test(compact);
}

test("public routes contain no staff or institutional links", () => {
  const publicRoutes = [
    "index.tsx",
    "help.tsx",
    "track.tsx",
    "ai.tsx",
    "services.tsx",
    "organizations.tsx",
    "ussd.tsx",
  ];
  for (const name of publicRoutes) {
    const source = routeSource(name);
    for (const routePath of ["/officers", "/institutions"]) {
      assert.equal(
        referencesRoute(source, routePath),
        false,
        `${name} must not reference ${routePath}`,
      );
    }
  }
});

test("shared public header contains every required public navigation key", () => {
  const source = readFileSync(join(COMPONENTS_DIR, "public-header.tsx"), "utf8").replace(/\s+/g, " ");
  for (const key of [
    "common.home",
    "common.getHelp",
    "common.aiAssistance",
    "common.verifiedServices",
    "common.organizations",
    "common.ussd",
    "common.trackMyRequest",
  ]) {
    assert.match(source, new RegExp(escapeRegExp(key)), `missing nav key: ${key}`);
  }
  assert.doesNotMatch(source, /common\.educationInformation/, "nav must use the exact AI Assistance label");
  assert.equal(referencesRoute(source, "/officers"), false, "public nav must not link officers");
  assert.equal(referencesRoute(source, "/institutions"), false, "public nav must not link institutions");
});

test("every public page uses the shared header", () => {
  for (const name of [
    "index.tsx",
    "help.tsx",
    "track.tsx",
    "ai.tsx",
    "services.tsx",
    "organizations.tsx",
    "ussd.tsx",
  ]) {
    assert.match(routeSource(name), /PublicHeader/, `${name} must use PublicHeader`);
  }
});

test("organizations and USSD routes are registered", () => {
  for (const [name, path] of [
    ["organizations.tsx", "/organizations"],
    ["ussd.tsx", "/ussd"],
  ]) {
    assert.equal(existsSync(join(ROUTES_DIR, name)), true, `src/routes/${name} is missing`);
    assert.match(
      routeSource(name).replace(/\s+/g, " "),
      new RegExp(`createFileRoute\\s*\\(\\s*["']${escapeRegExp(path)}["']\\s*\\)`),
      `${name} must create the ${path} route`,
    );
  }
});

test("institutional portal route file exists and registers /institutions", () => {
  const file = join(ROUTES_DIR, "institutions.tsx");
  assert.equal(existsSync(file), true, "src/routes/institutions.tsx is missing");
  const source = routeSource("institutions.tsx").replace(/\s+/g, " ");
  assert.match(
    source,
    /createFileRoute\s*\(\s*["']\s*\/institutions\s*["']\s*\)/,
    "institutions.tsx must create the /institutions route",
  );
});

test("existing staff route file is preserved", () => {
  assert.equal(
    existsSync(join(ROUTES_DIR, "officers.tsx")),
    true,
    "src/routes/officers.tsx is missing",
  );
});

test("institutional portal gates the workspace behind a signed-in session", () => {
  const source = routeSource("institutions.tsx");
  assert.match(source, /useStaffSession\(\)/, "portal must read the staff session");
  assert.match(
    source,
    /signedIn\s*&&\s*user\s*&&\s*session\.token/,
    "workspace must only render for an authenticated session",
  );
  assert.match(
    source,
    /institutions\.noPublicRegistration/,
    "portal must use the noPublicRegistration dictionary key",
  );
});

test("global controls expose both language and theme toggles", () => {
  const controls = readFileSync(join(COMPONENTS_DIR, "global-controls.tsx"), "utf8");
  assert.match(controls, /LanguageSwitcher/);
  assert.match(controls, /ThemeToggle/);
  const root = routeSource("__root.tsx");
  assert.match(root, /ThemeProvider/);
  assert.match(root, /THEME_BOOTSTRAP_SCRIPT/);
});
