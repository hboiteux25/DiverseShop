import { expect, test } from "./fixtures"

test.describe("formularios e validacoes", () => {
  test("produto novo mostra validacoes e estado sem fornecedores", async ({ page }) => {
    await page.goto("/produtos/novo")

    await expect(page.getByRole("heading", { name: "Novo produto", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /Criar produto/i })).toBeDisabled()

    await page.getByLabel(/Descricao|Descrição/i).fill("Caneta teste")
    await page.getByLabel(/Preco de compra|Preço de compra/i).fill("10")
    await page.getByLabel(/Preco de venda|Preço de venda/i).fill("15")

    await expect(page.getByText("R$ 5,00")).toBeVisible()
    await expect(page.getByText("33.3%")).toBeVisible()
  })

  test("fornecedor exige nome e contato valido", async ({ page }) => {
    await page.goto("/fornecedores")

    await page.getByRole("button", { name: /Novo Fornecedor/i }).click()
    await page.getByRole("dialog").locator("button[type='submit']").click()

    await expect(page.getByText(/Nome deve ter ao menos 2 caracteres/i)).toBeVisible()

    await page.getByLabel(/Nome/i).fill("Fornecedor QA")
    await page.getByLabel(/Contato/i).fill("contato-invalido")
    await page.getByRole("dialog").locator("button[type='submit']").click()

    await expect(page.getByText(/telefone ou email/i)).toBeVisible()
  })

  test("entrada de estoque exige produto selecionado", async ({ page }) => {
    await page.goto("/estoque?tab=entrada")

    await page.getByRole("button", { name: /Registrar entrada/i }).click()

    await expect(page.getByText(/Produto invalido|Produto inválido/i)).toBeVisible()
  })
})
