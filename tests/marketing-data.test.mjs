import test from 'node:test';
import assert from 'node:assert/strict';
import { metric, requireMetric, sumMetrics, formatMoney, formatNumber, formatRate, currentData } from '../src/modules/marketing/lib/dataQuality.ts';
import { consolidateMarketing } from '../src/modules/marketing/lib/consolidateMarketing.ts';
import { parseInsights } from '../src/modules/marketing/lib/parseMetaInsights.ts';
import { isGoogleConfigured, getGoogleAccountInsights, getGoogleCampaigns } from '../src/modules/marketing/api/googleAds.ts';

test('missing or invalid marketing values remain unknown; genuine zero is kept', () => {
  for (const input of [null, undefined, '', ' ', 'invalid', NaN, Infinity, {}, [], false]) assert.equal(metric(input), null);
  assert.equal(metric('0'), 0);
  assert.equal(metric(0), 0);
  assert.equal(metric('123.45'), 123.45);
  assert.throws(() => requireMetric(undefined));
  assert.equal(requireMetric('0'), 0);
  assert.equal(formatMoney(null), '—');
  assert.equal(formatNumber(0), '0');
  assert.equal(formatRate(0, 'x'), '0.00x');
  assert.equal(formatRate(null, 'x'), '—');
});

test('empty or incomplete metric sets are not silently summed as zero', () => {
  assert.equal(sumMetrics([]), null);
  assert.equal(sumMetrics([10, null]), null);
  assert.equal(sumMetrics([0, 0]), 0);
  assert.equal(sumMetrics([10, 20]), 30);
});

test('no available sources means unavailable KPIs, not a zero or demo total', () => {
  const result = consolidateMarketing();
  assert.equal(result.coverage, 'unavailable');
  for (const key of ['totalSpend', 'totalRevenue', 'totalClicks', 'roasGeral']) assert.equal(result[key], null);
  assert.equal(result.sources, '');
});

test('one available source is explicitly partial and does not fabricate Google spend', () => {
  const result = consolidateMarketing({ spend: 100, revenue: 300, clicks: 25 });
  assert.equal(result.coverage, 'partial');
  assert.equal(result.sources, 'Meta Ads');
  assert.equal(result.totalSpend, 100);
  assert.equal(result.totalRevenue, 300);
  assert.equal(result.roasGeral, 3);
});

test('mixed missing fields do not fabricate revenue or ROAS', () => {
  const result = consolidateMarketing({ spend: 100, revenue: null, clicks: 0 }, { spend: 20, revenue: 80, clicks: 5 });
  assert.equal(result.totalSpend, 120);
  assert.equal(result.totalRevenue, null);
  assert.equal(result.roasGeral, null);
  assert.equal(result.totalClicks, 5);
});

test('genuine zeroes remain visible but ROAS needs a positive denominator', () => {
  const zero = consolidateMarketing({ spend: 0, revenue: 0, clicks: 0 });
  assert.equal(zero.totalSpend, 0);
  assert.equal(zero.totalRevenue, 0);
  assert.equal(zero.roasGeral, null);
  assert.equal(consolidateMarketing({ spend: 100, revenue: 0, clicks: 0 }).roasGeral, 0);
});

test('Meta parsing preserves missing metrics and distinguishes explicit zero purchases', () => {
  const missing = parseInsights({ spend: '100' });
  assert.equal(missing.spend, 100);
  assert.equal(missing.clicks, null);
  assert.equal(missing.purchases, null);
  assert.equal(missing.purchaseValue, null);
  assert.equal(missing.roas, null);
  const zero = parseInsights({ spend: '100', clicks: '0', actions: [{ action_type: 'purchase', value: '0' }], action_values: [{ action_type: 'purchase', value: '0' }] });
  assert.equal(zero.purchases, 0);
  assert.equal(zero.purchaseValue, 0);
  assert.equal(zero.roas, 0);
  assert.equal(zero.clicks, 0);
  assert.ok(Object.values(parseInsights({})).every((value) => value === null));
});

test('a failed refresh does not expose old cache as current data', () => {
  const data = { spend: 100 };
  assert.equal(currentData({ data, isError: true }), undefined);
  assert.equal(currentData({ data, isError: false }), data);
});

test('Google Ads does not claim a working adapter and cannot return fixtures', async () => {
  assert.equal(isGoogleConfigured(), false);
  await assert.rejects(getGoogleAccountInsights(), /não implementada/);
  await assert.rejects(getGoogleCampaigns(), /não implementada/);
});
