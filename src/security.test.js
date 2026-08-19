import test from 'node:test';
import assert from 'node:assert/strict';
import { safeCsvCell } from './security.js';

test('escapes quotes in CSV fields', () => {
  assert.equal(safeCsvCell('Pérez "Junior"'), '"Pérez ""Junior"""');
});

test('neutralizes spreadsheet formulas', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd', '  =HYPERLINK("https://example.com")']) {
    assert.match(safeCsvCell(value), /^"\s*'/);
  }
});

test('keeps ordinary values unchanged', () => {
  assert.equal(safeCsvCell('Enrique 5to'), '"Enrique 5to"');
  assert.equal(safeCsvCell(null), '""');
});
