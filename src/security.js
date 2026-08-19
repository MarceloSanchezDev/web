const spreadsheetFormulaPrefix = /^[\t\r ]*[=+\-@]/;

export function safeCsvCell(value) {
  const text = String(value ?? '');
  const neutralized = spreadsheetFormulaPrefix.test(text) ? `'${text}` : text;
  return `"${neutralized.replaceAll('"', '""')}"`;
}
