# AGENTS.md — Diverse Shop DF · Sistema de Gestão

> Este arquivo é lido por agentes de IA (Codex, Claude Code, etc.) antes de qualquer tarefa.
> Siga **todas** as diretrizes abaixo sem exceção. Elas prevalecem sobre qualquer padrão genérico.

---

## 1. Identidade do Projeto

- **Nome:** Diverse Shop DF — Sistema de Gestão
- **Descrição:** Plataforma web para gestão de vendas, estoque, produtos, caixa e relatórios de uma loja de papelaria e presentes.
- **Idioma da interface:** Português do Brasil (pt-BR) em 100% dos textos visíveis ao usuário.
- **Idioma do código:** Inglês (variáveis, funções, tipos, comentários técnicos).

---

## 2. Stack Obrigatória

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js com App Router | 15.x |
| Banco de dados | Supabase (PostgreSQL + Auth + Realtime + Storage) | latest |
| IA / Chat | OpenAI API — modelo `gpt-4o-mini` | latest |
| Estilização | Tailwind CSS + shadcn/ui | latest |
| Formulários | react-hook-form + zod | latest |
| Linguagem | TypeScript (strict mode) | 5.x |
| Gerenciador de pacotes | pnpm | latest |

**Nenhuma dessas tecnologias pode ser substituída sem aprovação explícita.**

---

## 3. Arquitetura Next.js 15 App Router

### 3.1 Server Components por Padrão

- **Todo componente é Server Component por padrão.** Não adicionar `"use client"` sem necessidade real.
- Usar `"use client"` apenas quando houver: estado local (`useState`), efeitos (`useEffect`), eventos do browser, hooks de interatividade, ou uso de contextos que dependem do cliente.
- Data fetching acontece em Server Components via `async/await` direto — nunca usar `useEffect` para buscar dados que podem vir do servidor.

```typescript
// ✅ CORRETO — Server Component com fetch
export default async function ProductsPage() {
  const products = await getProducts() // server-side
  return <ProductList products={products} />
}

// ❌ ERRADO — fetch em useEffect no client
"use client"
export default function ProductsPage() {
  const [products, setProducts] = useState([])
  useEffect(() => { fetch('/api/products').then(...) }, [])
}
```

### 3.2 Estrutura de Pastas

```
src/
├── app/                        # App Router (Next.js 15)
│   ├── (auth)/                 # Grupo de rotas: login, register
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/            # Grupo de rotas protegidas
│   │   ├── layout.tsx          # Layout com sidebar
│   │   ├── page.tsx            # Dashboard principal
│   │   ├── produtos/
│   │   │   ├── page.tsx        # Lista de produtos
│   │   │   ├── novo/page.tsx   # Cadastro
│   │   │   └── [id]/page.tsx   # Edição
│   │   ├── vendas/
│   │   │   ├── page.tsx        # PDV
│   │   │   └── historico/page.tsx
│   │   ├── estoque/page.tsx
│   │   ├── caixa/page.tsx
│   │   ├── relatorios/page.tsx
│   │   ├── fornecedores/page.tsx
│   │   └── chat/page.tsx       # Chatbot IA
│   └── api/                    # Route Handlers (server-side only)
│       ├── chat/route.ts       # OpenAI proxy
│       ├── produtos/route.ts
│       ├── vendas/route.ts
│       ├── estoque/route.ts
│       └── importar/route.ts
├── components/
│   ├── ui/                     # shadcn/ui components (não editar)
│   ├── layout/                 # Sidebar, Header, Breadcrumb
│   ├── produtos/               # Componentes de produto
│   ├── vendas/                 # PDV, carrinho, pagamento
│   ├── estoque/                # Movimentações, alertas
│   ├── relatorios/             # Gráficos, tabelas
│   └── chat/                   # Interface do chatbot
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client (somente "use client")
│   │   ├── server.ts           # Server client (cookies)
│   │   └── middleware.ts       # Auth middleware
│   ├── openai.ts               # OpenAI client (server-only)
│   ├── validations/            # Schemas Zod
│   │   ├── product.ts
│   │   ├── sale.ts
│   │   └── stock.ts
│   └── utils.ts                # Helpers (formatCurrency, formatDate, etc.)
├── types/
│   └── index.ts                # Tipos globais TypeScript
├── hooks/                      # Custom hooks (client-side)
│   ├── use-barcode-scanner.ts
│   ├── use-realtime-stock.ts
│   └── use-offline-sales.ts
└── middleware.ts               # Auth guard global
```

### 3.3 Route Handlers (API)

- Toda chamada à OpenAI API e ao Supabase com service role key **deve passar por Route Handlers** (`app/api/`).
- Nunca importar `openai` ou usar `SUPABASE_SERVICE_ROLE_KEY` em componentes client.
- Route Handlers sempre retornam `NextResponse.json()` com status HTTP correto.

```typescript
// app/api/chat/route.ts
import { openai } from "@/lib/openai" // server-only import
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { messages } = await req.json()
  // ... lógica OpenAI
  return NextResponse.json({ reply })
}
```

---

## 4. TypeScript — Regras Estritas

- **Nunca usar `any`.** Usar `unknown` se o tipo for genuinamente desconhecido e tratar com type guards.
- **Nunca usar `as` para forçar tipos** sem verificação prévia.
- Todos os tipos de entidades do banco ficam em `src/types/index.ts`.
- Usar `satisfies` para validar objetos literais contra interfaces.
- Ativar `strict: true` no `tsconfig.json`.

```typescript
// src/types/index.ts
export type UserRole = "admin" | "operator"

export interface Product {
  id: string
  barcode: string | null
  description: string
  box_number: number | null
  supplier_id: string
  purchase_price: number
  sale_price: number
  stock_quantity: number
  min_stock: number
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  items: SaleItem[]
  total: number
  discount: number
  payment_method: PaymentMethod
  card_fee_rate: number | null
  net_received: number
  created_by: string
  created_at: string
}

export type PaymentMethod = "cash" | "pix" | "credit_card" | "debit_card"
export type StockMovementType = "in" | "out" | "adjustment"
```

---

## 5. Formulários — react-hook-form + Zod

- Todo formulário usa `useForm` do react-hook-form com `zodResolver`.
- Schemas Zod ficam em `src/lib/validations/`.
- Nunca validar no `onSubmit` manualmente — deixar o Zod fazer o trabalho.
- Mensagens de erro em português do Brasil.

```typescript
// src/lib/validations/product.ts
import { z } from "zod"

export const productSchema = z.object({
  description: z.string().min(3, "Descrição deve ter ao menos 3 caracteres"),
  barcode: z.string().optional(),
  box_number: z.number().int().positive().optional(),
  purchase_price: z.number().positive("Valor de compra deve ser positivo"),
  sale_price: z.number().positive("Valor de venda deve ser positivo"),
  min_stock: z.number().int().min(0).default(2),
  supplier_id: z.string().uuid("Fornecedor inválido"),
})

export type ProductFormData = z.infer<typeof productSchema>
```

---

## 6. Supabase — Padrões de Uso

### 6.1 Dois Clientes Distintos

```typescript
// src/lib/supabase/server.ts — para Server Components e Route Handlers
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* cookie handlers */ } }
  )
}

// src/lib/supabase/client.ts — somente em "use client" components
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 6.2 Row Level Security (RLS)

- **Todas as tabelas do Supabase devem ter RLS ativado.**
- Políticas baseadas em `auth.uid()` e papel do usuário (coluna `role` em `profiles`).
- Service role key usada **somente** em Route Handlers do servidor para operações administrativas.

### 6.3 Realtime

- Usar Supabase Realtime para atualização automática de estoque no PDV.
- Canal: `stock-updates` escutando tabela `stock_movements`.

---

## 7. OpenAI — Chatbot

- **Modelo obrigatório:** `gpt-4o-mini` (custo-benefício ideal).
- A chave `OPENAI_API_KEY` nunca é exposta ao cliente. Toda chamada passa pela route `/api/chat`.
- O chatbot tem dois modos:
  1. **Cadastro assistido:** ajuda a preencher campos de produto via conversa
  2. **Consulta de pedidos:** responde sobre estoque, vendas e sugestões de reposição
- System prompt em português, focado no contexto da loja.
- Usar streaming (`stream: true`) para resposta em tempo real na UI.

```typescript
// src/lib/openai.ts (server-only)
import OpenAI from "openai"

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const SYSTEM_PROMPT = `Você é o assistente da Diverse Shop DF, uma loja de papelaria e artigos de presente em Brasília-DF.

Você pode ajudar com:
1. Cadastro de produtos: colete nome, código de barras, fornecedor, preço de compra, preço de venda e número da caixa.
2. Consultas de estoque: informe quantidades, produtos em falta e sugestões de reposição.
3. Pedidos: ajude a montar listas de reposição com base no estoque atual.

Seja direto, amigável e use linguagem simples. Sempre confirme os dados antes de salvar.`
```

---

## 8. Design System

### 8.1 Tema

- **Dark mode por padrão**, com toggle para light mode.
- Fundo principal: `zinc-950` / `zinc-900`
- Cards: `zinc-900` com borda `zinc-800`
- **Cor de destaque:** `violet-500` / `indigo-500` (gradientes sutis)
- Texto primário: `zinc-50`, secundário: `zinc-400`
- Sucesso: `emerald-500`, Erro: `red-500`, Alerta: `amber-500`

### 8.2 Paleta de Gradientes

```css
/* Gradientes nos destaques e headers */
.gradient-primary { background: linear-gradient(135deg, #6d28d9, #4f46e5); }
.gradient-card-hover { background: linear-gradient(135deg, #18181b, #1e1b4b10); }
```

### 8.3 Componentes shadcn/ui

- Usar os componentes do shadcn/ui sem reinventar: Button, Input, Card, Table, Dialog, Sheet, Badge, Select, Tabs, Toast.
- Customizar via `className` e CSS variables do tema, nunca reescrever o componente.
- Todos os `toast` (notificações) devem usar o componente `Sonner` do shadcn.

### 8.4 Mobile-First

- Layout responsivo mobile-first em todos os componentes.
- Sidebar colapsa em drawer no mobile (usar `Sheet` do shadcn).
- PDV (ponto de venda) deve ser 100% funcional no celular — botões grandes, touch-friendly.
- Fonte base: `16px` mínimo para campos de formulário (evitar zoom automático no iOS).

### 8.5 Tipografia

- Font família: `Geist Sans` (padrão Next.js 15) + `Geist Mono` para valores numéricos.
- Hierarquia: `text-2xl font-bold` → título de página, `text-lg font-semibold` → seção, `text-sm` → labels.

---

## 9. Segurança

- **`.env.local` nunca commitado.** Está no `.gitignore`.
- Variáveis públicas (prefixo `NEXT_PUBLIC_`): apenas URL e anon key do Supabase.
- Variáveis privadas (sem prefixo): `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Validar e sanitizar toda entrada do usuário no servidor com Zod antes de qualquer operação no banco.
- Middleware de autenticação protege todas as rotas do grupo `(dashboard)`.

```typescript
// middleware.ts
export const config = {
  matcher: ["/(dashboard)/:path*", "/api/:path*"],
}
```

---

## 10. Qualidade de Código

### 10.1 Proibições Absolutas

```typescript
// ❌ PROIBIDO
console.log("qualquer coisa")   // Nenhum console.log no código final
const x: any = {}               // Nunca usar "any"
process.env.OPENAI_API_KEY      // Nunca em componente client
```

### 10.2 Nomenclatura

- **Componentes:** PascalCase (`ProductCard`, `SaleModal`)
- **Funções/variáveis:** camelCase (`getSalesByDay`, `cardFeeRate`)
- **Arquivos de componente:** kebab-case (`product-card.tsx`)
- **Tipos/interfaces:** PascalCase (`ProductFormData`, `SaleItem`)
- **Constantes:** UPPER_SNAKE_CASE (`MAX_DISCOUNT_RATE`)
- **Rotas de API:** kebab-case (`/api/importar-produtos`)

### 10.3 Tratamento de Erros

- Server Actions e Route Handlers sempre retornam `{ data, error }` — nunca deixar erros sem tratamento.
- Usar `try/catch` em todas as operações assíncronas.
- Erros do Supabase devem ser logados no servidor (sem expor ao client) e retornar mensagem genérica amigável.

```typescript
// Padrão de retorno de Server Actions
type ActionResult<T> = 
  | { data: T; error: null }
  | { data: null; error: string }
```

### 10.4 Performance

- Usar `React.Suspense` com skeleton loaders em listas e dashboards.
- Tabelas com mais de 50 linhas devem ter paginação ou virtualização.
- Imagens via `next/image` sempre.
- Evitar `useEffect` para lógica que pode ser feita no servidor.

---

## 11. Banco de Dados — Schema Supabase

### Tabelas Principais

```sql
-- Fornecedores
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  delivery_days int,
  created_at timestamptz default now()
);

-- Produtos
create table products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  description text not null,
  box_number int,
  supplier_id uuid references suppliers(id),
  purchase_price numeric(10,2) not null,
  sale_price numeric(10,2) not null,
  stock_quantity int not null default 0,
  min_stock int not null default 2,
  status text generated always as (
    case
      when stock_quantity = 0 then 'out_of_stock'
      when stock_quantity <= min_stock then 'low_stock'
      else 'in_stock'
    end
  ) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Movimentações de Estoque
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) not null,
  type text check (type in ('in', 'out', 'adjustment')) not null,
  quantity int not null,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Vendas
create table sales (
  id uuid primary key default gen_random_uuid(),
  total numeric(10,2) not null,
  discount numeric(10,2) default 0,
  payment_method text check (payment_method in ('cash','pix','credit_card','debit_card','mixed')) not null,
  card_fee_rate numeric(5,4),
  net_received numeric(10,2) not null,
  status text check (status in ('completed','cancelled')) default 'completed',
  cancel_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Itens da Venda
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) not null,
  product_id uuid references products(id) not null,
  quantity int not null,
  unit_price numeric(10,2) not null,
  discount numeric(10,2) default 0
);

-- Fechamento de Caixa
create table cash_closings (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  expected_cash numeric(10,2),
  counted_cash numeric(10,2),
  difference numeric(10,2) generated always as (counted_cash - expected_cash) stored,
  total_sales numeric(10,2),
  total_pix numeric(10,2),
  total_credit numeric(10,2),
  total_debit numeric(10,2),
  total_discount numeric(10,2),
  total_card_fees numeric(10,2),
  notes text,
  closed_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Perfis de Usuário
create table profiles (
  id uuid primary key references auth.users(id),
  name text not null,
  role text check (role in ('admin', 'operator')) default 'operator',
  created_at timestamptz default now()
);

-- Histórico de Preços
create table price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) not null,
  old_purchase_price numeric(10,2),
  new_purchase_price numeric(10,2),
  old_sale_price numeric(10,2),
  new_sale_price numeric(10,2),
  changed_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

---

## 12. Variáveis de Ambiente

Arquivo `.env.local` (nunca commitado):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# OpenAI
OPENAI_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CARD_FEE_DEFAULT=0.0299  # 2.99% taxa padrão cartão
```

---

## 13. Chatbot — Comportamento do Agente IA

O chatbot tem duas funcionalidades principais:

### 13.1 Cadastro Assistido de Produtos

O agente coleta os dados em conversa natural e ao final envia para a API:

```
Usuário: "quero cadastrar uma caneta nova"
Bot: "Qual é o nome/descrição do produto?"
Usuário: "Caneta Pokemon Color"
Bot: "Qual o código de barras? (pode pular se não tiver)"
...
Bot: "Tudo certo! Vou cadastrar: Caneta Pokemon Color, R$ 4,00 de compra, R$ 9,90 de venda. Confirma?"
Usuário: "sim"
Bot: [chama /api/produtos POST] "Produto cadastrado com sucesso! ✓"
```

### 13.2 Consultas e Pedidos

```
Usuário: "quais produtos estão acabando?"
Bot: [consulta /api/estoque?status=low_stock] "Encontrei 3 produtos com estoque crítico: ..."

Usuário: "monta uma lista de reposição"  
Bot: [analisa estoque] "Sugiro pedir ao fornecedor Papelandia: ..."
```

---

## 14. Checklist Pré-Commit

Antes de finalizar qualquer tarefa, verificar:

- [ ] Nenhum `console.log` no código
- [ ] Nenhum `any` no TypeScript
- [ ] Nenhuma chave de API no código client-side
- [ ] Formulários com validação Zod
- [ ] Textos visíveis ao usuário em português do Brasil
- [ ] Componentes com `"use client"` apenas quando necessário
- [ ] RLS ativado em todas as tabelas novas
- [ ] `.env.local` no `.gitignore`
- [ ] Tratamento de erro em todas as operações assíncronas
- [ ] Mobile-first testado (viewport 375px)
