import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { readAllSalesRows, requireSalesNumbers } from '../src/modules/ecommerce/api/vendasCanais.ts';

// Bundle the production modules unchanged, replacing only the transport. No real requests.
async function loadApi(entry) {
  const { outputFiles } = await build({
    entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'offline-transport', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/apiBase$/ }, () => ({ path: 'transport', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const apiBase = s => `/api/${s}`; export const proxyFetch = (...args) => globalThis.__salesTransport(...args);', loader: 'js' }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
}
const inventory = await loadApi('src/modules/supply/api/estoque.ts');
const ns = await loadApi('src/modules/ecommerce/api/nuvemshop.ts');
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const tiny = (products) => ({ retorno: { status: 'OK', numero_paginas: 3, produtos: products.map(produto => ({ produto })) } });
const order = (overrides = {}) => ({ id: 1, number: 1, status: 'closed', payment_status: 'paid', total: '100', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-02T10:00:00Z', products: [], ...overrides });

test('missing inventory fields remain unknown, while explicit zero survives', () => {
  for (const value of [null, undefined, '', ' ', false, [], {}, 'invalid', NaN, Infinity]) assert.equal(inventory.nullableNumber(value), null);
  assert.equal(inventory.nullableNumber('0'), 0);
  assert.equal(inventory.computeStatus({ estoqueErp: null, divergencia: null }), 'indisponivel');
  assert.equal(inventory.computeStatus({ estoqueErp: 0, divergencia: null }), 'ruptura');
});

test('inventory statistics count known balances independently of badge priority', () => {
  const result = inventory.calcEstoqueStats([
    { estoqueErp: null, divergencia: null }, { estoqueErp: 5, divergencia: -1 }, { estoqueErp: 0, divergencia: 0 },
  ]);
  assert.equal(result.skusBaixo, 1);
  assert.equal(result.skusRuptura, 1);
  assert.equal(result.skusDivergente, 1);
  assert.equal(result.saldosConhecidos, 2);
  assert.equal(result.skusComparados, 2);
  assert.equal(result.coberturaMediaDias, null);
  assert.equal(inventory.calcEstoqueStats([{ estoqueErp: null, divergencia: null }]).skusRuptura, null);
  assert.equal(inventory.calcEstoqueStats([]).skusDivergente, null);
});

test('inventory uses server proxy, preserves absent stock and discloses paging', async () => {
  const urls = [];
  globalThis.__salesTransport = async (url) => {
    urls.push(url);
    return url.includes('tiny') ? json(tiny([{ id: 1, nome: 'Real', codigo: 'A' }])) : json([{ variants: [{ sku: 'A', stock: 4 }] }]);
  };
  const result = await inventory.fetchEstoqueSnapshot();
  assert.equal(result.items[0].estoqueErp, null);
  assert.equal(result.items[0].estoqueNuvemshop, 4);
  assert.equal(result.items[0].divergencia, null);
  assert.equal(result.items[0].status, 'indisponivel');
  assert.equal(result.tinyPages, 3);
  assert.match(result.warnings[0], /página 1/);
  assert.ok(urls.every(url => !url.includes('token')));
});

test('Nuvemshop outage leaves inventory comparison unavailable without destroying Tiny data', async () => {
  globalThis.__salesTransport = async (url) => url.includes('tiny') ? json(tiny([{ id: 1, codigo: 'A', saldo_fisico: 10 }])) : json({ error: 'unavailable' }, 503);
  const result = await inventory.fetchEstoqueSnapshot();
  assert.equal(result.items[0].estoqueErp, 10);
  assert.equal(result.items[0].estoqueNuvemshop, null);
  assert.equal(result.nuvemshop.available, false);
  assert.match(result.nuvemshop.error, /503/);
  assert.equal(inventory.calcEstoqueStats(result.items).skusDivergente, null);
});

test('Tiny application errors with HTTP 200 reject instead of returning mock products', async () => {
  globalThis.__salesTransport = async (url) => url.includes('tiny') ? json({ retorno: { status: 'Erro', erros: [] } }) : json([]);
  await assert.rejects(inventory.fetchEstoqueSnapshot(), /não confirmou/);
});

test('ambiguous and unmanaged Nuvemshop balances are never reconciled', async () => {
  globalThis.__salesTransport = async (url) => url.includes('tiny')
    ? json(tiny([{ id: 1, codigo: 'A', saldo_fisico: 10 }, { id: 2, codigo: 'B', saldo_fisico: 5 }]))
    : json([{ variants: [{ sku: 'A', stock: 10 }, { sku: 'A', stock: 10 }] }, { stock_management: false, variants: [{ sku: 'B', stock: 0 }] }]);
  const result = await inventory.fetchEstoqueSnapshot();
  assert.ok(result.items.every(item => item.estoqueNuvemshop === null && item.divergencia === null));
});

test('Nuvemshop paid revenue excludes cancelled orders and keeps missing totals unknown', () => {
  assert.equal(ns.calcStats([order(), order({ id: 2, status: 'cancelled', total: '999' })]).totalRevenue, 100);
  assert.equal(ns.calcStats([order({ total: '' })]).totalRevenue, null);
  assert.equal(ns.calcStats([order({ total: '' })]).avgTicket, null);
  assert.equal(ns.calcStats([order({ total: '0' })]).totalRevenue, 0);
  assert.equal(ns.calcStats([]).avgTicket, null);
  assert.equal(ns.calcStats([]).totalRevenue, null);
});

test('Nuvemshop overview reuses one page for the list and the KPIs with period metadata', async () => {
  let calls = 0;
  globalThis.__salesTransport = async (url) => { calls++; assert.match(url, /per_page=200&page=1/); return json([order(), order({ id: 2, created_at: '2026-09-01T10:00:00Z' })]); };
  const result = await ns.fetchNSOverview();
  assert.equal(calls, 1);
  assert.equal(result.stats.totalOrders, result.orders.length);
  assert.equal(result.stats.totalRevenue, 200);
  assert.equal(result.periodStart, '2026-09-01T10:00:00.000Z');
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 200);
  assert.ok(result.fetchedAt);
});

test('Nuvemshop transport and application failures never become empty arrays or mocks', async () => {
  for (const [body, status] of [[{}, 503], [{ error: 'NUVEMSHOP_INVALID_TOKEN' }, 200], [{}, 200], [{}, 401]]) {
    globalThis.__salesTransport = async () => json(body, status);
    await assert.rejects(ns.fetchNSOrders());
  }
  globalThis.__salesTransport = async () => json([order({ created_at: '' })]);
  await assert.rejects(ns.fetchNSOrders(), /incompletos/);
});

test('sales paging follows the actual server cap and returns every counted row', async () => {
  const source = Array.from({ length: 1200 }, (_, i) => ({ id: String(i) }));
  const offsets = [];
  const result = await readAllSalesRows(async (from, to) => {
    offsets.push(from);
    return { data: source.slice(from, Math.min(to + 1, from + 300)), count: 1200, error: null };
  });
  assert.equal(result.length, 1200);
  assert.deepEqual(offsets, [0, 300, 600, 900]);
});

test('sales paging rejects incomplete, duplicate, changing and uncounted results', async () => {
  await assert.rejects(readAllSalesRows(async () => ({ data: [], count: 1, error: null })), /incompletos/);
  await assert.rejects(readAllSalesRows(async () => ({ data: [{ id: 'a' }, { id: 'a' }], count: 2, error: null })), /duplicados/);
  await assert.rejects(readAllSalesRows(async (from) => ({ data: [{ id: String(from) }], count: from ? 3 : 2, error: null })), /mudaram/);
  await assert.rejects(readAllSalesRows(async () => ({ data: [], count: null, error: null })), /quantidade/);
  await assert.rejects(readAllSalesRows(async () => ({ data: [], count: 50001, error: null })), /período menor/);
  await assert.rejects(readAllSalesRows(async (from) => ({ data: [{ id: String(from) }], count: 2, error: from ? new Error('offline') : null })), /offline/);
  assert.deepEqual(await readAllSalesRows(async () => ({ data: [], count: 0, error: null })), []);
});

test('sales numeric validation rejects null, blank and malformed values and preserves zero', () => {
  for (const value of [null, undefined, '', ' ', NaN, Infinity, {}, [], false]) assert.throws(() => requireSalesNumbers([{ amount: value }], ['amount']), /ausentes/);
  assert.deepEqual(requireSalesNumbers([{ amount: '0' }], ['amount']), [{ amount: 0 }]);
});

test('live module sources contain no fixture fallback or client-side secret configuration', async () => {
  for (const path of ['src/modules/supply/api/estoque.ts', 'src/modules/supply/pages/SupplyPage.tsx', 'src/modules/ecommerce/api/nuvemshop.ts', 'src/modules/ecommerce/pages/EcommercePage.tsx']) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /MOCK_|VITE_.*TOKEN|VITE_NUVEMSHOP_CONFIGURED/);
  }
});
