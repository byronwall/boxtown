import { describe, expect, it } from "vitest";
import { parseFollowUpSuggestions, parseGeneratedNodeBatch, parseQuestionSet } from "./service";

describe("add-nodes structured validation", () => {
  it("rejects malformed question payloads", () => {
    expect(() =>
      parseQuestionSet({
        questions: [
          {
            id: "scope",
            prompt: "Scope?",
            helperText: "Choose one",
            options: [{ id: "a", label: "A" }],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects malformed node batches", () => {
    expect(() =>
      parseGeneratedNodeBatch({
        summary: "Generated",
        nodes: [
          {
            id: "node-1",
            label: "Node 1",
            type: "component",
            depth: 2,
            purpose: "Purpose only",
          },
        ],
        links: [],
      }),
    ).toThrow();
  });

  it("requires exactly four follow-up suggestions", () => {
    expect(() =>
      parseFollowUpSuggestions({
        suggestions: [
          {
            id: "follow-1",
            label: "One",
            brief: "Do one",
            guidance: "Guide one",
          },
        ],
      }),
    ).toThrow();
  });
});
