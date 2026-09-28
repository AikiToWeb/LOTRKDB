import type { Card } from "./types";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export function registerCardSearch(cards: Card[]) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: Tool,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context) return;
  const life = new AbortController();
  const tool: Tool = {
    name: "search_lotr_cards",
    title: "반지의 제왕 LCG 카드 검색",
    description:
      "현재 도서관에 있는 카드 원문을 이름 또는 특성으로 검색합니다. 데이터를 변경하지 않습니다.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", maxLength: 100 } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute(input) {
      if (
        !input ||
        typeof input !== "object" ||
        !("query" in input) ||
        typeof input.query !== "string" ||
        input.query.length > 100
      )
        throw new Error("query must be a string up to 100 characters");
      const q = input.query.toLowerCase();
      const results = cards.filter((c) =>
        `${c.name} ${c.traits ?? ""}`.toLowerCase().includes(q),
      );
      return {
        count: results.length,
        cards: results
          .slice(0, 30)
          .map((c) => ({
            code: c.code,
            name: c.name,
            type: c.type_code,
            sphere: c.sphere_code,
            url: `https://ringsdb.com/card/${c.code}`,
          })),
      };
    },
  };
  try {
    void Promise.resolve(
      context.registerTool(tool, { signal: life.signal }),
    ).catch(() => {});
  } catch {
    /* Unsupported experimental API does not affect normal usage. */
  }
  return () => life.abort();
}
