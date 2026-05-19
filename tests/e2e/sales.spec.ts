import { expect, test } from "./fixtures"

test.describe("pdv e vendas", () => {
  test("mantem finalizacao bloqueada com carrinho vazio", async ({ page }) => {
    await page.goto("/vendas")

    await expect(page.getByText(/O carrinho esta vazio|O carrinho está vazio/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /FINALIZAR VENDA/i })).toBeDisabled()
  })

  test("busca sem produto mantem carrinho vazio e mostra feedback", async ({ page }) => {
    await page.goto("/vendas")

    await page.getByPlaceholder(/Buscar produto/i).fill("produto-qa-inexistente")
    await page.getByRole("button", { name: /^Buscar$/i }).click()

    await expect(page.getByText(/Nenhum produto encontrado|Erro ao carregar produtos/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /FINALIZAR VENDA/i })).toBeDisabled()
  })
})
