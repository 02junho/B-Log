import type { GitCommitRef } from "./schema";

/**
 * True only when `commit` is git's subcommand. A regex over the whole string
 * would also match `git log --grep=commit`, which would invent a commit that
 * this session never made.
 */
export function isGitCommitCommand(command: string): boolean {
  for (const segment of command.split(/[\n;&|]+/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    let i = tokens[0] === "sudo" ? 1 : 0;
    const binary = tokens[i];
    if (binary !== "git" && !binary?.endsWith("/git")) continue;
    i++;
    // git's own options come before the subcommand; -C and -c take a value.
    while (tokens[i]?.startsWith("-")) {
      const flag = tokens[i++];
      if ((flag === "-C" || flag === "-c") && i < tokens.length) i++;
    }
    if (tokens[i] === "commit") return true;
  }
  return false;
}

/**
 * Codex wraps shell calls in a script (`await tools.exec_command({cmd: …})`),
 * so the subcommand check above cannot see the command line. This looser test
 * is only ever trusted together with git's own commit report.
 */
const MENTIONS_COMMIT = /\bgit\b[^\n]{0,120}?\bcommit\b/;

/** git prints `[branch sha] subject` on a successful commit — and only then. */
const COMMIT_REPORT = /^\[[^\]\n]+?\s([0-9a-f]{7,40})\]\s*(.*)$/m;

/** -m / -am / --message, quoted or bare. Only the first -m; git joins the rest. */
const MESSAGE_FLAG =
  /(?:^|\s)(?:-[a-zA-Z]*m|--message)(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/;

/** Inside double quotes a shell only unescapes these four characters. */
const SHELL_ESCAPE = /\\(["\\$`])/g;

function messageFromCommand(command: string): string | undefined {
  const match = MESSAGE_FLAG.exec(command);
  if (!match) return undefined;
  const [, double, single, bare] = match;
  if (double !== undefined) return double.replace(SHELL_ESCAPE, (_, char: string) => char);
  return single ?? bare;
}

/**
 * A commit is only recorded once git confirms it: an explicit sha from the
 * host, or git's own `[branch sha]` report. A `git commit` that failed (hook
 * rejection, nothing staged) must never reach the analysis as a commit, and
 * neither may a command that merely reads history.
 */
export function gitCommitFrom(
  command: string,
  output: string,
  confirmedSha?: string,
): GitCommitRef | undefined {
  const invoked = isGitCommitCommand(command);
  const mention = MENTIONS_COMMIT.exec(command);
  if (!invoked && !mention) return undefined;
  const report = COMMIT_REPORT.exec(output);
  // A host-reported sha counts only when we saw the real command line.
  const sha = (invoked ? confirmedSha : undefined) ?? report?.[1];
  if (!sha) return undefined;
  // Search from `git … commit` onward, so an earlier command's -m in the same
  // line (`grep -m 1 foo && git commit …`) cannot become the commit message.
  const scope = mention ? command.slice(mention.index) : command;
  const message = messageFromCommand(scope) ?? report?.[2]?.trim() ?? "";
  return { sha, message };
}
