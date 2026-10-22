#!/usr/bin/env node
// LES guard: a Claude Code PreToolUse hook. Reads the tool call as JSON on stdin and
// exits 2 with a reason on stderr to block it. Enable with `les connect` or `les guard on` (`les guard on codex` for Codex).
// `guard.mjs session-start` is the matching SessionStart hook; it prints the bootstrap reminder.
// Codex sends the same stdin shape and honors exit 2; it runs with `--no-gate`.
// Gemini CLI runs with `--host gemini` (BeforeTool tool names mapped, SessionStart context as JSON).
import { appendFileSync, existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
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

// Claude Code caps hook stdout at 10,000 characters and silently swaps the rest for a 2,000-character preview.
export const hookCap = 10000;
const reminder = "Before editing: state context trace, risk, and acceptance. Write the test first. Review the final diff. End every task-scoped reply with the LES status footer.";

// Stop hook: a turn that used tools is task work and must end with the LES status footer; plain chat turns are left alone.
const turnLog = (id) => join(tmpdir(), "les-turn-" + String(id).replace(/[^\w-]/gu, "_"));
const footer = /^LES status: (?:COMPLETE\s+Session: CLOSEABLE|(?:BLOCKED|PENDING_USER_ACTION|FAILED|SKIPPED)\s+Session: KEEP_OPEN)\b/mu;

export function stop(call) {
  if (!call.session_id) return undefined;
  const worked = existsSync(turnLog(call.session_id));
  rmSync(turnLog(call.session_id), { force: true });
  if (call.stop_hook_active || !worked || footer.test(String(call.last_assistant_message || ""))) return undefined;
  return "End the reply with the LES status footer from policies/workflow-contracts.md: 'LES status: <COMPLETE|BLOCKED|PENDING_USER_ACTION|FAILED|SKIPPED>', then 'Session: CLOSEABLE' for COMPLETE or 'Session: KEEP_OPEN' otherwise, then 'Next safe action: ...'.";
}

// The bootstrap skill body plus every policy it loads, minus front matter. Empty when a file is unreadable.
export function bootstrapText(files = required()) {
  try { return files.slice(1).map((file) => readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/u, "").trim()).join("\n\n"); } catch { return ""; }
}

// SessionStart hook: stdout becomes session context. It also resets the read log, since /clear, resume, and compaction drop the files from context.
// The bootstrap is injected when it fits the cap and counts as read; otherwise the agent gets the read list and the gate stays on.
// ponytail: Codex has no Read tool to observe, so `--no-gate` hosts get the risky-call check and the reminder, not the read gate.
export function sessionStart(id, gated = true) {
  if (id) rmSync(readLog(id), { force: true });
  const files = required();
  const text = bootstrapText(files);
  if (text && text.length + reminder.length + 120 <= hookCap) {
    if (id) appendFileSync(readLog(id), files.join("\n") + "\n");
    return "LES bootstrap, loaded by the session-start hook. Do not re-read these files:\n\n" + text + "\n\n" + reminder;
  }
  if (!files.length) return "LES guard warning: the bootstrap skill is missing or its `loads` line is unreadable, so the read gate and bootstrap injection are off. Run `les doctor`, then `les` to repair the install. " + reminder;
  return "LES is active. Before any work in this session, read every file in this list, even when a handoff or plan looks complete: " + files.join(", ") + ". "
    + (gated ? "Edit, Write, and Bash calls are blocked until you do. " : "") + reminder;
}

// realpath: a symlinked install path (macOS /var, ~/.les-agents) would otherwise skip main and fail open.
if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  let call;
  try { call = JSON.parse(raw); } catch { call = undefined; }
  // Gemini CLI shares Claude Code's stdin keys (tool_input.command, .file_path); only the tool names and SessionStart output differ.
  const gemini = process.argv.includes("--host") && process.argv[process.argv.indexOf("--host") + 1] === "gemini";
  const noGate = gemini || process.argv.includes("--no-gate");
  if (process.argv.includes("session-start")) {
    const text = sessionStart(call?.session_id, !noGate);
    console.log(gemini ? JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }) : text);
    process.exit(0);
  }
  if (!call) process.exit(0);
  if (process.argv.includes("stop")) {
    const missingFooter = stop(call);
    if (missingFooter) {
      console.error("LES guard: " + missingFooter);
      process.exit(2);
    }
    process.exit(0);
  }
  if (gemini) call.tool_name = { run_shell_command: "Bash", read_file: "Read" }[call.tool_name] || call.tool_name;
  const reason = check(call, resolve(process.env.CLAUDE_PROJECT_DIR || call.cwd || process.cwd()));
  if (reason) {
    console.error("LES guard blocked this call: " + reason + ". Ask the user to run it or approve it explicitly.");
    process.exit(2);
  }
  // The risky-call check above fails closed (`onFailure: "block"` in the hook config). Bookkeeping errors, such as an unwritable tmpdir, must not lock the agent out.
  let missing;
  try {
    if (call.session_id) appendFileSync(turnLog(call.session_id), "x"); // marks the turn as task work for the Stop hook
    missing = noGate ? undefined : gate(call);
  } catch { missing = undefined; }
  if (missing) {
    console.error("LES guard blocked this call: " + missing);
    process.exit(2);
  }
}
