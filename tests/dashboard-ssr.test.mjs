import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
const require = createRequire(resolve('package.json'));
const { build } = require('esbuild');

test('dashboard SSR preserves unavailable vs measured zero and visible provenance', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'nice-dashboard-ssr-'));
 try {
  const outfile = join(dir, 'test.cjs');
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';
    import {renderToString} from 'react-dom/server';
    import {MemoryRouter} from 'react-router-dom';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import Dashboard from './src/modules/dashboard/pages/DashboardPage';
    import {monthKey} from './src/lib/dataIntegrity';
    globalThis.fetch=()=>{throw new Error('Network is forbidden in this test')};
    const keys=[['vendas_canais','dashboard',monthKey(),monthKey(-1)],['asaas','balance'],['asaas','receivables'],['asaas','overdue'],['tiny','pedidos','mes',monthKey()],['bling','contas-pagar','dashboard']];
    function render(mode) {
      const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,refetchOnMount:false,gcTime:Infinity}}});
      if(mode==='error')for(const queryKey of keys)client.getQueryCache().build(client,{queryKey}).setState({status:'error',error:new Error('offline'),fetchStatus:'idle'});
      else {
        const data=[[],{balance:0,totalTransferValue:0},{data:[],totalCount:0},{data:[],totalCount:0},[],{data:[]}];
        keys.forEach((key,i)=>client.setQueryData(key,data[i]));
      }
      const html=renderToString(<MemoryRouter><QueryClientProvider client={client}><Dashboard/></QueryClientProvider></MemoryRouter>);
      client.clear();return html;
    }
    const error=render('error');
    if(!error.includes('Indisponível') || /R\\$\\s*(?:&nbsp;)?0,00/.test(error))throw new Error('Unavailable became zero');
    for(const expected of ['CNPJ não identificado','Fonte:','Período:','Consulta falhou'])if(!error.includes(expected))throw new Error('Missing '+expected);
    const zero=render('zero');
    if(!/R\\$\\s*(?:&nbsp;)?0,00/.test(zero))throw new Error('Measured zero not rendered');
    if(!zero.includes('sem registro no período'))throw new Error('Missing sales must stay unavailable');
    if(/NaN/.test(zero+error))throw new Error('Invalid number rendered');
    console.log('Dashboard SSR assertions passed, no network used');
  `},bundle:true,jsx:'automatic',platform:'node',format:'cjs',outfile,define:{'import.meta.env':JSON.stringify({DEV:true,VITE_SUPABASE_URL:'https://example.invalid',VITE_SUPABASE_PUBLISHABLE_KEY:'local-public-test-key'})},logLevel:'silent'});
  execFileSync(process.execPath,[outfile],{stdio:'pipe',timeout:30_000});
 } finally { await rm(dir,{recursive:true,force:true}); }
});
