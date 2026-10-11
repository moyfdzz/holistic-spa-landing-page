import { describe, expect, it } from "vitest";
import { faq } from "./faq.js";

describe("faq data", () => {
  it("has unique ids", () => {
    expect(new Set(faq.map((item) => item.id)).size).toBe(faq.length);
  });

  it("has a question and an answer in both languages", () => {
    for (const item of faq) {
      for (const lang of /** @type {const} */ (["es", "en"])) {
        const { question, answer } = item.text[lang];
        expect(question.trim(), `${item.id}:${lang}:question`).not.toBe("");
        expect(answer.trim(), `${item.id}:${lang}:answer`).not.toBe("");
      }
    }
  });

  it("asks questions as questions", () => {
    for (const item of faq) {
      expect(item.text.es.question).toMatch(/^¿.*\?$/);
      expect(item.text.en.question).toMatch(/\?$/);
    }
  });
});
