import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectories = [
  "packages/schema",
  "packages/core",
  "packages/ui-react",
  "packages/adapters/json",
  "packages/adapters/csv",
  "packages/adapters/tanso",
];
const packDirectory = mkdtempSync(join(tmpdir(), "credit-estimator-pack-"));

const fail = (message) => {
  throw new Error(message);
};

try {
  for (const packageDirectory of packageDirectories) {
    const absoluteDirectory = join(root, packageDirectory);
    const manifest = JSON.parse(
      readFileSync(join(absoluteDirectory, "package.json"), "utf8"),
    );

    for (const key of ["name", "version", "description", "repository", "homepage", "bugs"]) {
      if (manifest[key] === undefined) fail(`${packageDirectory}: missing ${key}`);
    }
    if (manifest.publishConfig?.access !== "public") {
      fail(`${packageDirectory}: package must publish with public access`);
    }
    if (manifest.scripts?.prepack === undefined) {
      fail(`${packageDirectory}: missing prepack build`);
    }

    const before = new Set(readdirSync(packDirectory));
    execFileSync("pnpm", ["pack", "--pack-destination", packDirectory], {
      cwd: absoluteDirectory,
      stdio: "pipe",
    });
    const tarballName = readdirSync(packDirectory).find((name) => !before.has(name));
    if (tarballName === undefined) fail(`${packageDirectory}: pack produced no tarball`);

    const contents = execFileSync("tar", ["-tzf", join(packDirectory, tarballName)], {
      encoding: "utf8",
    }).split("\n");
    for (const requiredFile of [
      "package/package.json",
      "package/dist/index.js",
      "package/dist/index.d.ts",
    ]) {
      if (!contents.includes(requiredFile)) {
        fail(`${packageDirectory}: tarball missing ${requiredFile}`);
      }
    }
    if (
      packageDirectory === "packages/ui-react" &&
      !contents.includes("package/dist/styles.css")
    ) {
      fail(`${packageDirectory}: tarball missing package/dist/styles.css`);
    }

    for (const target of [manifest.main, manifest.types]) {
      if (typeof target !== "string" || !existsSync(join(absoluteDirectory, target))) {
        fail(`${packageDirectory}: missing built target ${String(target)}`);
      }
    }
  }

  const coreManifest = JSON.parse(
    readFileSync(join(root, "packages/core/package.json"), "utf8"),
  );
  const coreDependencies = Object.keys(coreManifest.dependencies ?? {}).sort();
  if (
    JSON.stringify(coreDependencies) !==
    JSON.stringify(["@tanso-hq/credit-forecast-schema", "decimal.js"])
  ) {
    fail("packages/core: unexpected production dependency");
  }

  const uiManifest = JSON.parse(
    readFileSync(join(root, "packages/ui-react/package.json"), "utf8"),
  );
  const uiDependencies = Object.keys(uiManifest.dependencies ?? {}).sort();
  if (JSON.stringify(uiDependencies) !== JSON.stringify(["@tanso-hq/credit-forecast-schema"])) {
    fail("packages/ui-react: core or adapter dependency detected");
  }

  const tansoManifest = JSON.parse(
    readFileSync(join(root, "packages/adapters/tanso/package.json"), "utf8"),
  );
  const tansoDependencies = Object.keys(tansoManifest.dependencies ?? {}).sort();
  if (
    JSON.stringify(tansoDependencies) !==
    JSON.stringify(["@tanso-hq/credit-forecast-schema", "zod"])
  ) {
    fail("packages/adapters/tanso: unexpected production dependency");
  }
} finally {
  rmSync(packDirectory, { recursive: true, force: true });
}
