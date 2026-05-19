# Relatorio de Testes E2E

## Resumo

Foi criado um agente de testes automatizados com Playwright para o projeto Diverse Shop DF.

Resultado da execucao completa:

- 47 testes passaram.
- 1 teste foi pulado intencionalmente no projeto desktop por ser exclusivo de viewport mobile.
- 0 falhas na ultima execucao completa.
- `pnpm lint` passou apos os ajustes.

Comando principal executado:

```bash
pnpm test:e2e
```

## Funcionalidades Testadas

- Login, cadastro e recuperacao de senha.
- Validacoes obrigatorias de formularios.
- Navegacao e renderizacao das principais rotas:
  `/login`, `/vendas`, `/produtos`, `/produtos/novo`, `/fornecedores`, `/estoque`, `/caixa`, `/relatorios`, `/chat`, `/dashboard`.
- Redirecionamento do alias `/dashboard`.
- Limpeza de parametros sensiveis na URL pelo middleware.
- Pagina 404.
- Contratos JSON das APIs `/api/produtos`, `/api/estoque`, `/api/vendas` e erro configurado de `/api/chat`.
- PDV com carrinho vazio, busca sem resultado e bloqueio de finalizacao sem itens.
- Responsividade desktop e mobile, incluindo drawer de navegacao mobile.
- Erros de console do navegador via fixture global.

## Cenarios Criados

- `tests/e2e/auth.spec.ts`: autenticacao e validacoes de login/cadastro.
- `tests/e2e/forms.spec.ts`: formularios de produto, fornecedor e entrada de estoque.
- `tests/e2e/routes.spec.ts`: rotas, redirecionamentos, 404 e tela em branco.
- `tests/e2e/sales.spec.ts`: fluxo basico do PDV.
- `tests/e2e/api.spec.ts`: chamadas de API e respostas JSON.
- `tests/e2e/responsive.spec.ts`: checks mobile/desktop.
- `tests/e2e/fixtures.ts`: fixture compartilhada para capturar `console.error` e `pageerror`.

## Bugs Encontrados e Correcoes

- O comando inicial do `webServer` passava `--` para o `next dev`, fazendo o Next interpretar `--hostname` como diretorio do projeto. Corrigido em `playwright.config.ts`.
- A porta `3000` estava ocupada no ambiente local. O Playwright agora usa `3100` por padrao, com override via `E2E_PORT`.
- O dashboard podia quebrar em ambiente sem Supabase configurado. Corrigido com fallback de papel `operator` e dados vazios quando a configuracao nao existe.
- O hook de realtime tentava criar client Supabase mesmo sem URL/chave publica. Corrigido para desativar realtime nesse caso.
- O lint apontou falso positivo no parametro `use` da fixture Playwright. Corrigido renomeando o parametro.

## Bugs/Limitacoes Ainda Encontrados

- Ha textos com acentuacao corrompida em varias telas nos snapshots do Playwright; palavras que deveriam aparecer como "Gestao", "Acoes" e "Relatorios" aparecem com caracteres quebrados. Recomendo uma revisao de encoding/UTF-8 nos arquivos fonte.
- Os testes rodam por padrao em ambiente isolado sem Supabase real para evitar tocar dados de producao. Por isso, CRUDs felizes, login real, permissoes reais de admin/operator e operacoes persistidas ainda precisam de um banco de teste com seed dedicado.
- O Next exibiu avisos de cache Webpack/OneDrive (`EPERM rename` em `.next/cache`). Nao quebrou a suite, mas pode deixar execucoes locais mais lentas ou ruidosas.

## Sugestoes de Melhoria

- Criar um projeto Supabase separado para E2E com seed fixo de usuarios admin/operator, fornecedores, produtos e vendas.
- Adicionar um modo `E2E_USE_REAL_ENV=1` em CI apontando para esse Supabase de teste.
- Criar fixtures para autenticar admin/operator e validar permissoes de rota com dados reais.
- Expandir os testes de CRUD para criar, editar e excluir produto/fornecedor em banco isolado.
- Adicionar screenshots em falha como artefato de CI e publicar `playwright-report`.

## Arquivos Criados/Alterados

- `playwright.config.ts`
- `tests/e2e/fixtures.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/forms.spec.ts`
- `tests/e2e/routes.spec.ts`
- `tests/e2e/sales.spec.ts`
- `tests/e2e/api.spec.ts`
- `tests/e2e/responsive.spec.ts`
- `package.json`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/hooks/use-realtime-stock.ts`
