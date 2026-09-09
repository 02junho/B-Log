export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Join the textual blocks of a content array, dropping images and any other
 * binary payload. A plain string is passed through unchanged.
 */
export function joinTextBlocks(value: unknown, types: readonly string[]): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .flatMap((part) =>
        isRecord(part) &&
        typeof part.type === "string" &&
        types.includes(part.type) &&
        typeof part.text === "string"
          ? [part.text]
          : [],
      )
      .join("\n");
  }
  return value === undefined ? "" : JSON.stringify(value);
}

/** Parse a line as JSON, or fail with the line number only — never the content. */
export function parseLine(line: string, index: number, tool: string): unknown {
  const trimmed = line.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Invalid ${tool} JSON at line ${index + 1}`);
  }
}
