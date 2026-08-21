// Точки мониторинга, доступные для типа exchange_rate. Единственный источник
// данных на MVP — агрегатор myfin.by (открытый вопрос №1, раздел 9 ТЗ, решён
// в пользу агрегатора вместо парсинга сайтов отдельных банков). Список банков
// ниже — это те, у которых на странице агрегатора для Жлобина есть основная
// строка курса (data-row-type="default", а не рекламная вставка приложения);
// id = data-bank-sef-alias на странице. Используется для UI-мультиселекта
// конфигурации и для фильтрации распарсенных курсов.
export interface KnownBankSource {
  id: string;
  label: string;
}

export const ZHLOBIN_RUB_URL = "https://myfin.by/currency/rub/zhlobin";

export const KNOWN_BANK_SOURCES: KnownBankSource[] = [
  { id: "alfabank", label: "Альфа Банк" },
  { id: "belagroprombank", label: "Белагропромбанк" },
  { id: "belarusbank", label: "Беларусбанк" },
  { id: "belgazprombank", label: "Белгазпромбанк" },
  { id: "belinvestbank", label: "Белинвестбанк" },
  { id: "bps-sberbank", label: "Сбер Банк" },
  { id: "bvebank", label: "Банк БелВЭБ" },
  { id: "mtbank", label: "МТБанк" },
  { id: "priorbank", label: "Приорбанк" },
  { id: "statusbank", label: "СтатусБанк" },
];

export const DEFAULT_TRACKED_SOURCE_IDS = KNOWN_BANK_SOURCES.map((source) => source.id);

export function sourceLabel(id: string): string {
  return KNOWN_BANK_SOURCES.find((source) => source.id === id)?.label ?? id;
}
