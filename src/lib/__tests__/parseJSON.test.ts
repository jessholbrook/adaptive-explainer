import { describe, expect, it } from "vitest";
import { parseJSON } from "../llm";

describe("parseJSON", () => {
  it("parses a bare JSON object", () => {
    expect(parseJSON<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses JSON inside a fenced code block", () => {
    const text = 'Here you go:\n```json\n{"steps": [1, 2]}\n```\nDone.';
    expect(parseJSON<{ steps: number[] }>(text)).toEqual({ steps: [1, 2] });
  });

  it("parses JSON inside an unlabeled fence", () => {
    expect(parseJSON<{ a: string }>('```\n{"a": "b"}\n```')).toEqual({ a: "b" });
  });

  it("extracts JSON surrounded by prose", () => {
    const text = 'Sure! The answer is {"answer": "yes"} — hope that helps.';
    expect(parseJSON<{ answer: string }>(text)).toEqual({ answer: "yes" });
  });

  it("handles braces inside string values", () => {
    const text = '{"answer": "an object looks like {key: value}", "n": 1}';
    expect(parseJSON<{ n: number }>(text).n).toBe(1);
  });

  it("handles escaped quotes inside strings", () => {
    const text = '{"answer": "she said \\"hi\\" {"}';
    expect(parseJSON<{ answer: string }>(text).answer).toBe('she said "hi" {');
  });

  it("parses a top-level array", () => {
    expect(parseJSON<number[]>("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("stops at the end of the first complete object", () => {
    const text = '{"a": 1} trailing garbage {"b": 2}';
    expect(parseJSON<{ a: number }>(text)).toEqual({ a: 1 });
  });

  it("throws when there is no JSON at all", () => {
    expect(() => parseJSON("no json here")).toThrow(/No JSON/);
  });

  it("throws on unterminated JSON", () => {
    expect(() => parseJSON('{"a": {"b": 1}')).toThrow(/Unterminated/);
  });
});
