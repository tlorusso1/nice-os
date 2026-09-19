# Roadmap

## Em andamento

- [x] Localizar onde custos fixos, estoques e demais dados antigos estão persistidos e explicar por que não aparecem no banco.
- [ ] Restaurar a edição e atualização dos dados financeiros e de estoque na tela Operações.
- [ ] Sincronizar automaticamente vendas e notas fiscais do Tiny e Bling.
  - [x] Importar histórico com backfill paginado e retomável.
  - [x] Atualizar diariamente somente a janela incremental necessária.
  - [x] Consolidar faturamento por canal sem duplicar pedidos entre sistemas.
  - [x] Gravar produtos pela saída fiscal real, priorizando SKUs `[B]` e excluindo PACKs de vitrine.
  - [x] Mapear lojas/marketplaces do Bling para Nuvemshop, Shopee, Ritz Pay, Nice SP e demais canais.
  - [x] Registrar execução, cursores, erros e totais para auditoria.
  - [ ] Validar o backfill e a rotina diária com dados reais.