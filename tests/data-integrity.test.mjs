import test from 'node:test';
import assert from 'node:assert/strict';
import { finiteNumber, sumKnown, monthKey, monthBounds, percentageChange, syncFailedSources } from '../src/lib/dataIntegrity.ts';

test('missing and invalid numbers remain unavailable; real zero survives', () => {
  for (const value of [null, undefined, '', ' ', NaN, Infinity, 'invalid']) assert.equal(finiteNumber(value), null);
  assert.equal(finiteNumber(0), 0);
  assert.equal(finiteNumber('1.234,56'), 1234.56);
  assert.equal(sumKnown([1, null]), null);
  assert.equal(sumKnown([]), 0);
});
test('month boundaries handle end-of-month and leap years', () => {
  assert.equal(monthKey(-1, new Date(2026, 2, 31)), '2026-02');
  assert.deepEqual(monthBounds(new Date(2024, 1, 20)), {start:'2024-02-01', end:'2024-02-29'});
  assert.equal(monthKey(-1, new Date(2026, 0, 31)), '2025-12');
});
test('unknown or zero comparison base is not a fabricated percentage', () => {
  assert.equal(percentageChange(100, null), null);
  assert.equal(percentageChange(100, 0), null);
  assert.equal(percentageChange(0, 100), -100);
});
test('HTTP-success with source errors is still a failed or partial sync', () => {
  assert.deepEqual(syncFailedSources({tiny:{orders:1},bling:{error:'offline'}}), ['bling']);
  assert.deepEqual(syncFailedSources({tiny:{orders:0},bling:{orders:0}}), []);
  assert.ok(syncFailedSources({}).length);
  assert.ok(syncFailedSources(null).length);
});
