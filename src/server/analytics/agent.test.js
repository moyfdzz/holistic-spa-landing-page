import { describe, expect, it } from "vitest";
import { isBot, parseUserAgent } from "./agent.js";

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const androidChrome =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const windowsEdge =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const ipad =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("parseUserAgent", () => {
  it("classifies phones, tablets and computers", () => {
    expect(parseUserAgent(iphone)).toEqual({
      device: "mobile",
      browser: "Safari",
      os: "iOS",
    });
    expect(parseUserAgent(androidChrome)).toEqual({
      device: "mobile",
      browser: "Chrome",
      os: "Android",
    });
    expect(parseUserAgent(windowsEdge)).toEqual({
      device: "desktop",
      browser: "Edge",
      os: "Windows",
    });
    expect(parseUserAgent(ipad).device).toBe("tablet");
  });

  it("falls back to Other", () => {
    expect(parseUserAgent("")).toEqual({
      device: "desktop",
      browser: "Other",
      os: "Other",
    });
  });
});

describe("isBot", () => {
  it("flags crawlers, tools and empty user agents", () => {
    expect(isBot("")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120")).toBe(
      true,
    );
    expect(isBot("curl/8.0")).toBe(true);
    expect(isBot("Mozilla/5.0 Chrome-Lighthouse")).toBe(true);
  });

  it("lets real browsers through", () => {
    expect(isBot(iphone)).toBe(false);
    expect(isBot(windowsEdge)).toBe(false);
  });
});
