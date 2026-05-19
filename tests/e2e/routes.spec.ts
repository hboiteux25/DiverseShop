import { expect, test } from "./fixtures"

const publicPages = [
  { path: "/login", text: /Entrar no sistema/i },
  { path: "/vendas", text: /Carrinho/i },
  { path: "/produtos", text: /Produtos/i },
  { path: "/produtos/novo", text: /Novo produto/i },
  { path: "/fornecedores", text: /Fornecedores/i },
  { path: "/estoque", text: /Controle de estoque/i },
  { path: "/caixa", text: /Fechamento de Caixa/i },
  { path: "/relatorios", text: /Relatorios|Relatórios/i },
  { path: "/chat", text: /Chat IA/i },
]

test.describe("rotas e navegacao", () => {
  for (const route of publicPages) {
    test(`renderiza ${route.path} sem tela em branco`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" })

      await expect(page.getByText(route.text).first()).toBeVisible()
      await expect(page.locator("body")).not.toHaveText("")
    })
  }

  test("redireciona alias /dashboard para a raiz operacional", async ({ page }) => {
    await page.goto("/dashboard")

    await expect(page).toHaveURL(/\/$/)
  })

  test("remove parametros sensiveis da URL", async ({ page }) => {
    await page.goto("/login?access_token=segredo&email=cliente%40teste.com")

    await expect(page).toHaveURL((url) => {
      return !url.searchParams.has("access_token") && !url.searchParams.has("email")
    })
  })

  test("responde 404 para rota inexistente", async ({ page }) => {
    const response = await page.goto("/rota-inexistente-e2e")

    expect(response?.status()).toBe(404)
    await expect(page.locator("body")).toContainText(/404|not found|não encontrada/i)
  })
})
