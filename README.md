# Diverse Shop DF

Sistema web de gestão para a **Diverse Shop DF**, uma loja de papelaria e presentes. O projeto foi iniciado com Next.js 15, App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase e OpenAI.

## Visão Geral

O objetivo do sistema é centralizar as rotinas operacionais da loja em uma aplicação rápida, responsiva e preparada para evoluir com segurança.

Principais áreas planejadas:

- **Dashboard:** visão geral de vendas, estoque, caixa e alertas.
- **Produtos:** cadastro, edição, preços, fornecedores e códigos de barras.
- **Vendas / PDV:** fluxo de venda com carrinho, desconto e formas de pagamento.
- **Estoque:** movimentações, alertas de estoque baixo e atualização em tempo real.
- **Caixa:** fechamento diário, conferência de valores e taxas de cartão.
- **Relatórios:** indicadores de vendas, produtos e reposição.
- **Fornecedores:** organização de contatos e prazos de entrega.
- **Chat IA:** assistente para cadastro de produtos, consultas de estoque e sugestões de reposição.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 15 com App Router |
| Linguagem | TypeScript em strict mode |
| Interface | Tailwind CSS + shadcn/ui |
| Tema | Dark mode por padrão com CSS variables |
| Banco/Auth | Supabase PostgreSQL + Auth + Realtime + Storage |
| IA | OpenAI API |
| Formulários | react-hook-form + Zod |
| Tabelas | TanStack React Table |
| Notificações | Sonner |
| Ícones | Lucide React |
| Pacotes | pnpm |

## Estrutura Inicial

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── produtos/
│   ├── vendas/
│   ├── estoque/
│   ├── relatorios/
│   └── chat/
├── hooks/
├── lib/
│   ├── supabase/
│   └── validations/
└── types/
```

## Requisitos

- Node.js 20 ou superior
- pnpm
- Projeto Supabase configurado
- Chave da OpenAI API para o chatbot

## Configuração Local

Instale as dependências:

```bash
pnpm install
```

Crie o arquivo de ambiente:

```bash
cp .env.local.example .env.local
```

Preencha as variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CARD_FEE_DEFAULT=0.0299
```

Rode o servidor de desenvolvimento:

```bash
pnpm dev
```

Acesse:

```text
http://localhost:3000
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia o servidor de desenvolvimento |
| `pnpm build` | Gera build de produção |
| `pnpm start` | Inicia a aplicação após o build |
| `pnpm lint` | Executa o ESLint |
| `pnpm exec tsc --noEmit` | Valida os tipos TypeScript |

## Padrões do Projeto

- Interface 100% em português do Brasil.
- Código, variáveis, funções e tipos em inglês.
- Server Components por padrão.
- `"use client"` apenas quando houver interatividade real no navegador.
- Nenhuma chave sensível em componentes client-side.
- Validação com Zod antes de operações no servidor.
- Supabase service role apenas em Route Handlers do servidor.
- shadcn/ui como base dos componentes visuais.
- Sonner para notificações.

## Estado Atual

O projeto já contém:

- Scaffold Next.js 15 com App Router.
- Tailwind CSS e shadcn/ui configurados.
- Dark mode por classe.
- Estrutura de rotas e pastas inicial.
- Tipos principais de produto, venda e estoque.
- Clientes Supabase para browser, servidor e middleware.
- Route Handlers iniciais para chat, produtos, vendas, estoque e importação.
- Arquivo `.env.local.example` sem valores reais.

## Validação

Últimas verificações executadas:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Também foi validado que o servidor Next.js responde com status `200` em ambiente local.

## Diretrizes para Agentes

As regras completas de arquitetura, qualidade, Supabase, OpenAI, design system e checklist pré-commit estão no arquivo [AGENTS.md](./AGENTS.md).
