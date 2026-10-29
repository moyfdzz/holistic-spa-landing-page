import { describe, expect, it } from "vitest";
import { classifySource, referrerHost } from "./source.js";

const siteHost = "www.masajesrelaxmty.com";
const classify = (/** @type {object} */ input) =>
  classifySource({ siteHost, ...input }).channel;

describe("classifySource", () => {
  it("uses the UTM parameters first", () => {
    expect(classify({ utmSource: "google", utmMedium: "maps" })).toBe(
      "google_maps",
    );
    expect(classify({ utmSource: "Instagram", utmMedium: "bio" })).toBe(
      "instagram",
    );
    expect(classify({ utmSource: "facebook", utmMedium: "page" })).toBe(
      "facebook",
    );
    expect(classify({ utmSource: "newsletter", utmMedium: "email" })).toBe(
      "campaign",
    );
  });

  it("lets a UTM source win over the referrer", () => {
    expect(
      classify({
        utmSource: "instagram",
        referrer: "https://www.google.com/",
      }),
    ).toBe("instagram");
  });

  it("classifies by referrer host", () => {
    expect(classify({ referrer: "https://www.google.com/" })).toBe(
      "google_search",
    );
    expect(classify({ referrer: "https://www.google.com.mx/" })).toBe(
      "google_search",
    );
    expect(classify({ referrer: "https://maps.google.com/" })).toBe(
      "google_maps",
    );
    expect(classify({ referrer: "https://www.bing.com/" })).toBe("bing");
    expect(classify({ referrer: "https://l.instagram.com/" })).toBe(
      "instagram",
    );
    expect(classify({ referrer: "https://l.facebook.com/" })).toBe("facebook");
    expect(classify({ referrer: "https://web.whatsapp.com/" })).toBe(
      "whatsapp",
    );
    expect(classify({ referrer: "https://example.org/blog" })).toBe(
      "other_site",
    );
  });

  it("recognizes direct visits and navigation inside the site", () => {
    expect(classify({})).toBe("direct");
    expect(classify({ referrer: "not a url" })).toBe("direct");
    expect(classify({ referrer: "https://www.masajesrelaxmty.com/" })).toBe(
      "internal",
    );
  });

  it("does not take a look-alike host for Google", () => {
    expect(classify({ referrer: "https://notgoogle.com.evil.test/" })).toBe(
      "other_site",
    );
  });
});

describe("referrerHost", () => {
  it("returns the host without www", () => {
    expect(referrerHost("https://www.Example.com/path?x=1")).toBe(
      "example.com",
    );
    expect(referrerHost(undefined)).toBe("");
  });
});
