import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyAuditFilters, availableOfficerIds, matchesAuditFilters, parseFilterDate, periodRange, dateRangeError } from './auditFilters.js';

test('periods use local calendar dates and Monday to Sunday across month/year boundaries', () => {
  const now = new Date(2026, 0, 1, 23, 30);
  assert.deepEqual(periodRange('today', now), { from: '01-01-2026', to: '01-01-2026' });
  assert.deepEqual(periodRange('week', now), { from: '29-12-2025', to: '04-01-2026' });
  assert.deepEqual(periodRange('month', new Date(2024, 1, 20)), { from: '01-02-2024', to: '29-02-2024' });
});
test('validates display dates and inverted ranges', () => {
  assert.equal(parseFilterDate('29-02-2024'), '2024-02-29');
  assert.equal(parseFilterDate('29-02-2026'), null);
  assert.equal(parseFilterDate('31-04-2026'), null);
  assert.ok(dateRangeError({ from: '25-09-2026', to: '01-09-2026' }));
});
test('officers derive from all records, deduplicate and omit missing IDs', () => {
  assert.deepEqual(availableOfficerIds([{ officerId: 'OFF-102' }, { officerId: 'OFF-102' }, { officer_id: 'OFF-2' }, {}]), ['OFF-2', 'OFF-102']);
});
test('search, officer and inclusive range intersect; reset includes missing/invalid dates', () => {
  const rows = [
    { id: '1', officerId: 'OFF-102', defaulter: 'Prisma', timestamp: '2026-09-01 00:00:00' },
    { id: '2', officerId: 'OFF-102', defaulterName: 'PRISMA', timestamp: '2026-09-30 23:59:59' },
    { id: '3', officerId: 'OFF-103', defaulter: 'Prisma', timestamp: '2026-09-12' },
    { id: '4', officerId: 'OFF-102', defaulter: 'Prisma', timestamp: '2026-10-01' },
    { id: '5', officerId: 'OFF-102', defaulter: 'Someone else', timestamp: '2026-09-10' },
    { id: '6', officerId: 'OFF-102', defaulter: 'Prisma', timestamp: 'invalid' },
  ];
  const filters = { search: ' prisma ', officer: 'OFF-102', from: '01-09-2026', to: '30-09-2026', period: 'month' };
  assert.deepEqual(rows.filter(row => matchesAuditFilters(row, filters)).map(row => row.id), ['1', '2']);
  assert.equal(rows.filter(row => matchesAuditFilters(row, emptyAuditFilters())).length, rows.length);
  assert.equal(matchesAuditFilters(rows[0], { ...filters, from: 'bad' }), false);
});
test('search supports order/case identifiers but not officer names or prompts', () => {
  for (const field of ['id', 'orderId', 'order_id', 'caseId', 'case_id', 'caseNumber', 'defaulterName']) {
    assert.ok(matchesAuditFilters({ [field]: 'MATCH' }, { ...emptyAuditFilters(), search: 'match' }));
  }
  assert.equal(matchesAuditFilters({ officerName: 'MATCH', notes: 'MATCH' }, { ...emptyAuditFilters(), search: 'match' }), false);
});
