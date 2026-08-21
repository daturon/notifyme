import { describe, expect, it } from "vitest";
import { parseMyfinRates } from "./parseMyfin";

// Замоканный фрагмент реальной вёрстки myfin.by/currency/rub/zhlobin: одна
// рекламная строка (data-row-type="ad", должна игнорироваться) и две
// основные строки банков (data-row-type="default").
const SAMPLE_HTML = `
<table class="currencies-courses">
  <tbody>
    <tr class="currencies-courses__row-main currencies-courses__row-main--ad" data-bank-sef-alias="mtbank" data-row-type="ad">
      <td><img alt="Myfin Обмен"></td>
      <td class="currencies-courses__currency-cell "><span>99.9</span></td>
    </tr>
    <tr class="currencies-courses__row-main" data-row-type="default" data-bank-sef-alias="alfabank">
      <td><span><img alt="Альфа Банк"></span></td>
      <td class="currencies-courses__currency-cell "><span>3.5</span></td>
      <td class="currencies-courses__currency-cell "><span>3.6</span></td>
    </tr>
    <tr class="currencies-courses__row-main" data-row-type="default" data-bank-sef-alias="statusbank">
      <td><img alt="СтатусБанк"></td>
      <td class="currencies-courses__currency-cell "><span class="best accent tooltip-click" title="Лучший курс">3.505</span></td>
      <td class="currencies-courses__currency-cell "><span>3.555</span></td>
    </tr>
  </tbody>
</table>
`;

describe("parseMyfinRates", () => {
  it("parses only default rows, ignoring ad rows", () => {
    const rates = parseMyfinRates(SAMPLE_HTML);

    expect(rates).toEqual([
      { sourceId: "alfabank", label: "Альфа Банк", buyRatePer100: 3.5 },
      { sourceId: "statusbank", label: "СтатусБанк", buyRatePer100: 3.505 },
    ]);
  });

  it("reads the buy rate even when the span carries extra classes/attrs", () => {
    const rates = parseMyfinRates(SAMPLE_HTML);
    const statusBank = rates.find((r) => r.sourceId === "statusbank");
    expect(statusBank?.buyRatePer100).toBe(3.505);
  });

  it("returns an empty array when the page format changes (no matching rows)", () => {
    const rates = parseMyfinRates("<html><body>completely different markup</body></html>");
    expect(rates).toEqual([]);
  });

  it("skips a default row with no numeric rate cell", () => {
    const html = `
      <tr class="currencies-courses__row-main" data-row-type="default" data-bank-sef-alias="brokenbank">
        <td><img alt="Broken Bank"></td>
        <td class="currencies-courses__currency-cell "><span></span></td>
      </tr>
    `;
    expect(parseMyfinRates(html)).toEqual([]);
  });
});
