const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function brazilDateStartAsIso(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error("Data de renovação inválida.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const initialParts = zonedParts(new Date(utcMidnight));
  const representedAsUtc = Date.UTC(
    Number(initialParts.year),
    Number(initialParts.month) - 1,
    Number(initialParts.day),
    Number(initialParts.hour),
    Number(initialParts.minute),
    Number(initialParts.second),
  );
  const offset = representedAsUtc - utcMidnight;
  const result = new Date(utcMidnight - offset);
  const resultParts = zonedParts(result);

  if (
    Number(resultParts.year) !== year
    || Number(resultParts.month) !== month
    || Number(resultParts.day) !== day
    || Number(resultParts.hour) !== 0
  ) {
    throw new Error("Não foi possível calcular o fim do período pago.");
  }

  return result.toISOString();
}
