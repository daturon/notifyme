import * as cheerio from "cheerio";

// Одна строка курса, распарсенная со страницы myfin.by.
export interface ParsedBankRate {
  sourceId: string;
  label: string;
  // курс сдачи RUB (колонка "Сдать") в BYN за 100 RUB
  buyRatePer100: number;
}

// Разбирает HTML страницы myfin.by/currency/rub/<город> (пример:
// https://myfin.by/currency/rub/zhlobin). На странице таблица курсов банков
// содержит рекламные строки (data-row-type="ad" — приложения/бронирование
// курса) вперемешку с основными строками банков (data-row-type="default") —
// нас интересуют только последние, иначе один банк даёт несколько
// конкурирующих "лучших" курсов из рекламы.
//
// Формат страницы — открытый вопрос №1 из раздела 9 ТЗ; если myfin изменит
// вёрстку, эта функция вернёт пустой массив, а не упадёт — вызывающий код
// (fetchRates.ts) трактует это как отказ источника (см. пункт 3 задания:
// не должен падать весь cron).
export function parseMyfinRates(html: string): ParsedBankRate[] {
  const $ = cheerio.load(html);
  const rates: ParsedBankRate[] = [];

  $('tr.currencies-courses__row-main[data-row-type="default"]').each((_, row) => {
    const $row = $(row);
    const sourceId = $row.attr("data-bank-sef-alias");
    if (!sourceId) return;

    const label = $row.find("img[alt]").first().attr("alt")?.trim() || sourceId;

    // Первая ячейка курса в строке — "Сдать" (RUB, множитель 100), см.
    // заголовок таблицы: колонки идут в порядке Сдать/Купить для RUB, затем
    // то же для USD/RUB и EUR/RUB.
    const buyCellText = $row.find("td.currencies-courses__currency-cell").first().find("span").first().text().trim();
    const buyRatePer100 = Number(buyCellText.replace(",", "."));
    if (!buyCellText || !Number.isFinite(buyRatePer100)) return;

    rates.push({ sourceId, label, buyRatePer100 });
  });

  return rates;
}
