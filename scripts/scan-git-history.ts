// Redacted git-history secret scan. Run: npm run scan:history
// Prints rule/path/object metadata only; never prints matched secret text.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_TEXT_BLOB_BYTES = 1024 * 1024;

type Rule = {
  name: string;
  pattern: RegExp;
};

type Finding = {
  rule: string;
  object: string;
  path: string;
};

const rules: Rule[] = [
  {
    name: "private-key-block",
    pattern: /-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----/,
  },
  {
    name: "hex-private-key",
    pattern: /\b0x[a-fA-F0-9]{64}\b/,
  },
  {
    name: "secret-assignment",
    pattern:
      /\b(PRIVATE_KEY|API_SECRET|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN|GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*[:=]\s*["'][^"'\r\n]{20,}["']/,
  },
  {
    name: "github-token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/,
  },
  {
    name: "github-fine-grained-token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{80,}\b/,
  },
];

function git(args: string[], maxBuffer = 1024 * 1024): Buffer {
  return execFileSync("git", args, {
    cwd: ROOT,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function isLikelyBinary(buf: Buffer): boolean {
  return buf.includes(0);
}

const objectLines = git(["rev-list", "--objects", "--all"], 64 * 1024 * 1024)
  .toString("utf8")
  .split(/\r?\n/)
  .filter(Boolean);

const seen = new Set<string>();
const findings: Finding[] = [];
let scanned = 0;
let skippedLarge = 0;
let skippedBinary = 0;

for (const line of objectLines) {
  const firstSpace = line.indexOf(" ");
  const object = firstSpace === -1 ? line : line.slice(0, firstSpace);
  const path = firstSpace === -1 ? "(no path)" : line.slice(firstSpace + 1);

  if (seen.has(object)) continue;
  seen.add(object);

  const type = git(["cat-file", "-t", object]).toString("utf8").trim();
  if (type !== "blob") continue;

  const size = Number(git(["cat-file", "-s", object]).toString("utf8"));
  if (!Number.isFinite(size) || size > MAX_TEXT_BLOB_BYTES) {
    skippedLarge++;
    continue;
  }

  const content = git(["cat-file", "-p", object], size + 1024);
  if (isLikelyBinary(content)) {
    skippedBinary++;
    continue;
  }

  scanned++;
  const text = content.toString("utf8");
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      findings.push({
        rule: rule.name,
        object: object.slice(0, 12),
        path,
      });
    }
  }
}

console.log("Pharos git-history scan");
console.log(`  text blobs scanned : ${scanned}`);
console.log(`  large blobs skipped: ${skippedLarge}`);
console.log(`  binary blobs skipped: ${skippedBinary}`);

if (findings.length === 0) {
  console.log("  findings           : 0");
  console.log("No secret-like patterns found in reachable git history.");
  process.exit(0);
}

console.error(`  findings           : ${findings.length}`);
console.error(
  "Potential secret-like patterns found; matched values are redacted.",
);
for (const finding of findings) {
  console.error(
    `  ${finding.rule}  object=${finding.object}  path=${finding.path}`,
  );
}
process.exit(1);
