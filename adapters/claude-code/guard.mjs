#!/usr/bin/env node
// LES guard: a Claude Code PreToolUse hook. Reads the tool call as JSON on stdin and
// exits 2 with a reason on stderr to block it. Enable with `les guard on`.
import { homedir } from "node:os";
import { resolve } from "node:path";
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
        const absolute = resolve(project, target);
        if (absolute !== project && !absolute.startsWith(project + "/") || absolute === home() || absolute === "/") return "deletes outside the project: " + word;
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  let call;
  try { call = JSON.parse(raw); } catch { process.exit(0); }
  const reason = check(call, resolve(process.env.CLAUDE_PROJECT_DIR || call.cwd || process.cwd()));
  if (reason) {
    console.error("LES guard blocked this call: " + reason + ". Ask the user to run it or approve it explicitly.");
    process.exit(2);
  }
}
