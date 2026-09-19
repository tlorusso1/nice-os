# Sincronização automática de vendas e notas fiscais

## Objetivo

Sincronizar Tiny e Bling sem misturar produtos de vitrine com os itens que realmente deram baixa no estoque.

## Implementação

1. **Faturamento por canal**
   - Importar pedidos aprovados/faturados do Tiny e Bling.
   - Identificar o canal pela loja/marketplace de origem.
   - Evitar duplicidade quando o mesmo pedido existir nos dois sistemas.

2. **Produtos vendidos pela nota fiscal**
   - Consultar notas fiscais emitidas e seus itens no Tiny e no Bling.
   - Gravar os SKUs fiscais reais, priorizando os códigos `[B]`.
   - Não tratar PACKs do ecommerce como baixa física de estoque.

3. **Backfill histórico**
   - Processar mês a mês, com paginação e limite configurável.
   - Persistir o progresso para permitir retomada segura após falhas ou limite de tempo.
   - Reprocessar períodos de forma idempotente, substituindo os agregados da mesma fonte.

4. **Atualização incremental diária**
   - Reprocessar uma janela curta dos últimos dias para capturar emissões e alterações tardias.
   - Manter uma execução diária única para Tiny e Bling.
   - Registrar totais, fontes e erros para auditoria.

5. **Validação**
   - Executar o backfill com as credenciais disponíveis.
   - Conferir totais por mês, canal, fonte e SKUs `[B]`.
   - Validar que a atualização diária não duplica dados.

## Detalhes técnicos

- A função continuará isolando falhas: Tiny pode concluir mesmo se Bling estiver temporariamente indisponível, e vice-versa.
- O token do Bling será renovado automaticamente quando as credenciais OAuth estiverem configuradas.
- As tabelas agregadas continuarão somente leitura para usuários; apenas a função de sincronização grava nelas.
- A interface existente de Dashboard, Ecommerce, B2B e Vendas por Canal será mantida.

