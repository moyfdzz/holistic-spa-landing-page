import { describe, expect, it } from "vitest";
import { csvCell, csvFilename, toCsv } from "./csv.js";

const metrics = {
  visitors: 3,
  sessions: 4,
  pageViews: 9,
  events: 12,
  engagedSeconds: 80,
  bounces: 1,
  bounceRate: 0.25,
  avgEngagedSeconds: 20,
};

describe("csvCell", () => {
  it("writes plain values as they are", () => {
    expect(csvCell("instagram")).toBe("instagram");
    expect(csvCell(12)).toBe("12");
    expect(csvCell(0.25)).toBe("0.25");
  });

  it("leaves empty values empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("neutralizes what a spreadsheet would read as a formula", () => {
    for (const text of [
      '=HYPERLINK("http://evil.example")',
      "+1+1",
      "-2+3",
      "@SUM(A1)",
      "\t=1+1",
    ]) {
      expect(csvCell(text).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(csvCell("=1+1")).toBe("'=1+1");
  });

  it("does not touch a path or a number that only contains those characters inside", () => {
    expect(csvCell("/en/contact")).toBe("/en/contact");
    expect(csvCell("a=b")).toBe("a=b");
    expect(csvCell(-1)).toBe("-1");
  });
});

describe("toCsv", () => {
  it("starts with a byte order mark and a header, and ends each line with CRLF", () => {
    const csv = toCsv("channel", [{ key: "instagram", ...metrics }]);
    expect(csv.startsWith("\uFEFFkey,visitors,sessions,page_views,")).toBe(
      true,
    );
    expect(csv.split("\r\n")).toEqual([
      "\uFEFFkey,visitors,sessions,page_views,events,engaged_seconds,bounces,bounce_rate,avg_engaged_seconds",
      "instagram,3,4,9,12,80,1,0.25,20",
      "",
    ]);
  });

  it("labels the first column `bucket` for the series", () => {
    const csv = toCsv("series", [{ bucket: "2026-10-26", ...metrics }]);
    expect(csv.split("\r\n")[0]).toMatch(/^\uFEFFbucket,visitors,/);
    expect(csv.split("\r\n")[1]).toMatch(/^2026-10-26,3,/);
  });

  it("gives only the header for an empty table", () => {
    expect(toCsv("city", []).split("\r\n")).toHaveLength(2);
  });

  it("neutralizes a key that comes from a visitor", () => {
    const csv = toCsv("referrer_host", [
      { key: '=HYPERLINK("x")', ...metrics },
    ]);
    expect(csv).toContain('\r\n"\'=HYPERLINK(""x"")",3,');
  });
});

describe("csvFilename", () => {
  it("names the table and the range", () => {
    expect(
      csvFilename("channel", { from: "2026-10-29", to: "2026-11-04" }),
    ).toBe("analytics-channel-2026-10-29_2026-11-04.csv");
  });
});
