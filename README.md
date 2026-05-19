# Diverse Shop DF

Sistema web de gestão para a **Diverse Shop DF**, uma loja de papelaria e presentes. A aplicação centraliza vendas, produtos, estoque, fornecedores, caixa, relatórios, permissões e atendimento assistido por IA.

## Visão Geral

O objetivo do projeto é oferecer uma interface operacional clara, rápida e segura para a rotina da loja, com foco em leitura objetiva, baixo atrito e uso diário por administradores e operadores.

Áreas principais:

- **Dashboard:** indicadores de vendas, estoque, caixa e alertas.
- **Vendas / PDV:** carrinho, descontos, formas de pagamento e venda offline.
- **Produtos:** cadastro, edição, importação, preços, fornecedores e códigos de barras.
- **Estoque:** entradas, ajustes, alertas de estoque baixo e atualização em tempo real.
- **Fornecedores:** cadastro e organização de contatos.
- **Caixa:** fechamento diário e conciliação de recebimentos.
- **Relatórios:** indicadores operacionais e financeiros.
- **Assistente IA:** apoio ao cadastro de produtos, consultas e sugestões de reposição.
- **Permissões:** gestão de usuários e controle de acesso por tela.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 15 com App Router |
| Linguagem | TypeScript em strict mode |
| Interface | Tailwind CSS + shadcn/ui |
| Tema | Light mode por padrão |
| Banco/Auth | Supabase PostgreSQL + Auth + Realtime + Storage |
| IA | OpenAI API |
| Formulários | react-hook-form + Zod |
| Tabelas | shadcn/ui Table + renderização server-side |
| Notificações | Sonner |
| Ícones | Lucide React |
| Pacotes | pnpm |

## Estrutura

```text
src/
├── app/
│   ├── (auth)/                 # Login, cadastro e reset de senha
│   ├── (dashboard)/            # Rotas protegidas do sistema
│   ├── actions/                # Server Actions
│   └── api/                    # Route Handlers
├── components/
│   ├── ui/                     # Componentes shadcn/ui
│   ├── layout/
│   ├── produtos/
│   ├── vendas/
│   ├── estoque/
│   ├── fornecedores/
│   ├── caixa/
│   ├── chat/
│   └── usuarios/
├── hooks/
├── lib/
│   ├── permissions/            # Catálogo, descoberta e checagem de telas
│   ├── supabase/
│   └── validations/
└── types/
```

## Requisitos

- Node.js 20 ou superior
- pnpm via Corepack
- Projeto Supabase configurado
- Chave da OpenAI API para o assistente

## Configuração Local

Instale as dependências:

```bash
corepack pnpm install
```

Crie o arquivo de ambiente:

```bash
copy .env.local.example .env.local
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
corepack pnpm dev
```

Acesse:

```text
http://localhost:3000
```

Se a porta `3000` estiver ocupada:

```bash
corepack pnpm exec next dev --port 3002
```

## Supabase

As migrations ficam em `supabase/migrations`.

Principais tabelas:

- `profiles`
- `products`
- `suppliers`
- `stock_movements`
- `sales`
- `sale_items`
- `cash_closings`
- `price_history`
- `app_screens`
- `role_screen_permissions`

Todas as tabelas públicas novas devem ter RLS habilitado. As permissões administrativas usam o perfil salvo em `profiles.role`.

## Permissões por Tela

O sistema possui controle de acesso por perfil de operador:

- Administradores acessam todas as telas.
- Operadores acessam apenas as telas liberadas em **Permissões > Acesso por tela**.
- Telas sem permissão são removidas do menu.
- Acesso direto por URL é bloqueado pelo `middleware`.
- Quando o operador tenta acessar manualmente uma rota sem permissão, é redirecionado para `/acesso-negado`.

### Detecção Automática de Telas

As telas são detectadas automaticamente a partir de arquivos:

```text
src/app/(dashboard)/**/page.tsx
```

Quando um administrador acessa o sistema, `syncDiscoveredScreens` sincroniza as páginas encontradas com a tabela `app_screens`.

Novas telas recebem por padrão:

```text
default_access = admin
```

Ou seja, somente administradores acessam até que a tela seja liberada manualmente para operadores.

### Como Personalizar uma Nova Tela

Ao criar uma nova página, adicione metadados opcionais em:

```text
src/lib/permissions/screen-metadata.ts
```

Exemplo:

```ts
"/minha-rota": {
  title: "Minha tela",
  description: "Descrição exibida na matriz de permissões.",
  iconName: "file",
  sortOrder: 130,
  showInNavigation: true,
  defaultAccess: "admin",
}
```

Se não houver metadados, o sistema cria nome e descrição automaticamente a partir da rota.

## Scripts

| Comando | Descrição |
| --- | --- |
| `corepack pnpm dev` | Inicia o servidor de desenvolvimento |
| `corepack pnpm build` | Gera build de produção |
| `corepack pnpm start` | Inicia a aplicação após o build |
| `corepack pnpm lint` | Executa o ESLint |
| `corepack pnpm exec tsc --noEmit` | Valida os tipos TypeScript |
| `corepack pnpm test:e2e` | Executa testes end-to-end |

## Qualidade

Padrões importantes:

- Interface em português do Brasil.
- Código, variáveis, funções e tipos em inglês.
- Server Components por padrão.
- `"use client"` apenas para interatividade real.
- Nenhuma chave sensível em componentes client-side.
- Validação com Zod antes de mutações no servidor.
- Supabase service role somente em rotas/ações server-side apropriadas.
- shadcn/ui como base visual.
- Sonner para feedbacks.
- Sem `console.log` no código final.
- Sem `any` em TypeScript.

## Validação

Comandos recomendados antes de finalizar mudanças:

```bash
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm build
```

## Observação Sobre CSS no Dev Server

Se a aplicação abrir sem estilos, geralmente é cache corrompido do Next em `.next`. Pare o servidor, remova `.next` e rode novamente:

```bash
rmdir /s /q .next
corepack pnpm dev
```

## Diretrizes para Agentes

As regras completas de arquitetura, qualidade, Supabase, OpenAI, design system e checklist pré-commit estão em [AGENTS.md](./AGENTS.md).
