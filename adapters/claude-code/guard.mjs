#!/usr/bin/env node
// LES guard: a Claude Code PreToolUse hook. Reads the tool call as JSON on stdin and
// exits 2 with a reason on stderr to block it. Enable with `les guard on` (`les guard on codex` for Codex).
// `guard.mjs session-start` is the matching SessionStart hook; it prints the bootstrap reminder.
// Codex sends the same stdin shape and honors exit 2; it runs with `--no-gate`.
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const secretPath = /(?:^|[\\/])(?:\.env(?!\.(?:example|sample|template)\b)[\w.-]*|\.ssh[\\/][^\s]*|id_(?:rsa|dsa|ecdsa|ed25519)|\.aws[\\/]credentials|\.netrc|[\w.-]+\.pem)$/u;
const readers = /(?:^|[\s;&|(])(?:cat|less|more|head|tail|grep|rg|awk|sed|bat|xxd|base64|strings|source|cp|scp)\s/u;
const protectedBranch = /(?:^|[\s:+/])(?:main|master|trunk|develop|release[\w./-]*)$/u;

function words(segment) {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/gu) || []).map((word) => word.replace(/^["']|["']$/gu, ""));
}

function home() {
  return process.env.HOME || homedir();
}

// Windows paths are case-insensitive and drive letters arrive in either case.
function same(path) {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

function expand(path) {
  return path.replace(/^~(?=$|\/)/u, home()).replace(/^\$\{?HOME\}?(?=$|\/)/u, home());
}

export function check(call, project = process.cwd()) {
  const input = call.tool_input || {};
  if (call.tool_name === "Read") return secretPath.test(String(input.file_path || "")) ? "reads a secret file: " + input.file_path : undefined;
  if (call.tool_name !== "Bash" || typeof input.command !== "string") return undefined;
  const command = input.command;
  for (const segment of command.split(/&&|\|\||[;|\n]/u)) {
    const parts = words(segment);
    const first = parts.findIndex((word) => !/^[A-Za-z_][\w]*=/u.test(word));
    if (first < 0) continue;
    if (readers.test(" " + segment + " ") && parts.slice(first + 1).some((word) => secretPath.test(expand(word)))) return "reads a secret file";
    if (parts[first] === "rm" || (parts[first] === "find" && parts.includes("-delete"))) {
      for (const word of parts.slice(first + 1).filter((word) => !word.startsWith("-") && word !== "!")) {
        if (parts[first] === "find" && word !== parts[first + 1]) continue;
        const target = expand(word);
        if (/[$`]/u.test(target)) return "deletes an unresolved path: " + word;
        const absolute = same(resolve(project, target));
        const root = same(project);
        if (absolute !== root && !absolute.startsWith(root + sep) || absolute === same(home()) || absolute === "/") return "deletes outside the project: " + word;
      }
    }
    if (parts[first] === "git" && parts[first + 1] === "push") {
      const force = parts.some((word) => word === "-f" || word === "--force" || word.startsWith("--force-with-lease") || /^\+\S/u.test(word));
      const targets = parts.slice(first + 2).filter((word) => !word.startsWith("-"));
      if (force && (!targets.length || targets.some((word) => protectedBranch.test(word)))) return "force-pushes a protected or unspecified branch";
    }
  }
  return undefined;
}

// Files the bootstrap requires: the adapter, the bootstrap skill, and everything its `loads` front matter lists.
export function required() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const skill = resolve(root, "skills", "les-bootstrap", "SKILL.md");
  try {
    const loads = JSON.parse(/^loads: (\[.*\])$/mu.exec(readFileSync(skill, "utf8"))[1]);
    return [resolve(root, "adapters", "claude-code", "CLAUDE.md"), skill, ...loads.map((path) => resolve(dirname(skill), path))];
  } catch { return []; } // ponytail: unreadable bootstrap fails open so the guard never locks the agent out
}

// Per-session record of which required files were Read; edits and shell calls stay blocked until all are present.
const readLog = (id) => join(tmpdir(), "les-bootstrap-" + String(id).replace(/[^\w-]/gu, "_"));
const gated = new Set(["Bash", "Edit", "Write", "MultiEdit", "NotebookEdit"]);

export function gate(call) {
  if (!call.session_id) return undefined;
  const log = readLog(call.session_id);
  if (call.tool_name === "Read") {
    appendFileSync(log, resolve(String(call.tool_input?.file_path || "")) + "\n");
    return undefined;
  }
  if (!gated.has(call.tool_name)) return undefined;
  const seen = existsSync(log) ? readFileSync(log, "utf8").split("\n").map(same) : [];
  const missing = required().filter((file) => !seen.includes(same(file)));
  return missing.length ? "LES bootstrap is not fully read in this session. Read these files with the Read tool first: " + missing.join(", ") : undefined;
}

// SessionStart hook: stdout becomes session context. It also resets the read log, since /clear, resume, and compaction drop the files from context.
// ponytail: Codex has no Read tool to observe, so `--no-gate` hosts get the risky-call check and the reminder, not the read gate.
export function sessionStart(id, gated = true) {
  if (id) rmSync(readLog(id), { force: true });
  return "LES is active. Before any work in this session, read every file in this list, even when a handoff or plan looks complete: " + required().join(", ") + ". "
    + (gated ? "Edit, Write, and Bash calls are blocked until you do. " : "")
    + "Before editing: state context trace, risk, and acceptance. Write the test before the code. Review the final diff. End every task-scoped reply with the LES status footer from policies/workflow-contracts.md.";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  let call;
  try { call = JSON.parse(raw); } catch { call = undefined; }
  if (process.argv.includes("session-start")) {
    console.log(sessionStart(call?.session_id, !process.argv.includes("--no-gate")));
    process.exit(0);
  }
  if (!call) process.exit(0);
  const reason = check(call, resolve(process.env.CLAUDE_PROJECT_DIR || call.cwd || process.cwd()));
  if (reason) {
    console.error("LES guard blocked this call: " + reason + ". Ask the user to run it or approve it explicitly.");
    process.exit(2);
  }
  const missing = process.argv.includes("--no-gate") ? undefined : gate(call);
  if (missing) {
    console.error("LES guard blocked this call: " + missing);
    process.exit(2);
  }
}
