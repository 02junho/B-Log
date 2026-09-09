/**
 * Step 3 CLI: session log → common-schema JSON.
 *
 *   npm run parse -- <log file> [--out <file>] [--format claude-code|codex] [--stats]
 *
 * The output is normalized, not masked. Masking (Step 5·7) runs later in the
 * pipeline, so never publish this file or paste it anywhere shared. Write it to
 * `.parsed/` (gitignored) or outside the repo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { detectFormat, parseSession, type SourceTool } from "../src/lib/parser";
import { sessionStats } from "../src/lib/parser/stats";

/** Only the implemented gates: forcing "transcript" could never parse. */
const FORMATS: SourceTool[] = ["claude-code", "codex"];

function usage(message?: string): never {
  if (message) console.error(`error: ${message}`);
  console.error(
    "usage: npm run parse -- <log file> [--out <file>] [--format claude-code|codex] [--stats]",
  );
  process.exit(message ? 1 : 0);
}

function main(argv: string[]): void {
  let input: string | undefined;
  let out: string | undefined;
  let format: SourceTool | undefined;
  let statsOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage();
    else if (arg === "--stats") statsOnly = true;
    else if (arg === "--out") out = argv[++i];
    else if (arg === "--format") {
      const value = argv[++i];
      if (!FORMATS.includes(value as SourceTool)) usage(`unknown format: ${value}`);
      format = value as SourceTool;
    } else if (arg.startsWith("-")) usage(`unknown option: ${arg}`);
    else if (input) usage("more than one input file");
    else input = arg;
  }

  if (!input) usage("no input file");
  if (out === undefined && argv.includes("--out")) usage("--out needs a path");

  const lines = readFileSync(input!, "utf8").split(/\r?\n/);
  const detected = format ?? detectFormat(lines);
  if (detected === "transcript") {
    usage(
      "could not recognize this as a Claude Code or Codex log. The transcript gate is not wired up yet.",
    );
  }
  const session = parseSession(lines, detected);
  const stats = sessionStats(session);

  console.error(`format: ${detected}${format ? " (forced)" : ""}`);
  console.error(`stats: ${JSON.stringify(stats)}`);

  if (statsOnly) return;

  const json = JSON.stringify(session, null, 2);
  if (out) {
    writeFileSync(out, json + "\n");
    console.error(`wrote ${out} — normalized, NOT masked. Do not publish as is.`);
  } else {
    console.log(json);
  }
}

main(process.argv.slice(2));
