import * as XLSX from "xlsx-js-style"
import type { CellStyle } from "xlsx-js-style"

export type ProductControlExportRow = {
  barcode: string | null
  description: string
  boxNumber: number | null
  supplierName: string
  purchasePrice: number
  salePrice: number
  stockQuantity: number
  soldQuantity: number
}

export type ProductControlValidationResult = {
  errors: string[]
  warnings: string[]
}

type WorkbookCellValue = string | number | null

const SHEET_NAME = "Controle Geral 2024"
const CURRENCY_FORMAT = '"R$" #,##0.00'
const INTEGER_FORMAT = "0"
const HEADER_ROW = 4
const FIRST_DATA_ROW = 5
const ORIGINAL_COLUMNS = [
  { wch: 0.11 },
  { wch: 5.11 },
  { wch: 20.78 },
  { wch: 66.89 },
  { wch: 20.56 },
  { wch: 21.11 },
  { wch: 20.56 },
  { wch: 19.11 },
  { wch: 16.11 },
  { wch: 13 },
  { wch: 11.33 },
  { wch: 26.56 },
  { wch: 26.56 },
  { wch: 26.56 },
  { wch: 22.89 },
  { wch: 22 },
]
const THIN_BORDER = {
  color: { rgb: "FF808080" },
  style: "thin",
} satisfies NonNullable<NonNullable<CellStyle["border"]>["top"]>
const TOP_HEADER_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "FFA6A6A6" } },
  font: { bold: true, color: { rgb: "FF000000" }, name: "Calibri", sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: THIN_BORDER,
    bottom: THIN_BORDER,
    left: THIN_BORDER,
    right: THIN_BORDER,
  },
} satisfies CellStyle
const COLUMN_HEADER_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "FF000000" } },
  font: { bold: true, color: { rgb: "FFFFFFFF" }, name: "Calibri", sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: THIN_BORDER,
    bottom: THIN_BORDER,
    left: THIN_BORDER,
    right: THIN_BORDER,
  },
} satisfies CellStyle
const DATA_CELL_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "FFF2F2F2" } },
  font: { color: { rgb: "FF000000" }, name: "Calibri", sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: THIN_BORDER,
    bottom: THIN_BORDER,
    left: THIN_BORDER,
    right: THIN_BORDER,
  },
} satisfies CellStyle
const SUMMARY_CELL_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "FF262626" } },
  font: { bold: true, color: { rgb: "FFFFFFFF" }, name: "Calibri", sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: THIN_BORDER,
    bottom: THIN_BORDER,
    left: THIN_BORDER,
    right: THIN_BORDER,
  },
} satisfies CellStyle

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function getInitialStock(row: ProductControlExportRow) {
  return row.stockQuantity + row.soldQuantity
}

function getProfit(row: ProductControlExportRow) {
  return roundMoney(row.salePrice - row.purchasePrice)
}

function normalizeOptionalText(value: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null
}

export function validateProductControlRows(
  rows: ProductControlExportRow[],
): ProductControlValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const barcodes = new Set<string>()

  rows.forEach((row, index) => {
    const rowNumber = FIRST_DATA_ROW + index
    const barcode = normalizeOptionalText(row.barcode)

    if (row.description.trim().length < 3) {
      errors.push(`Linha ${rowNumber}: descricao ausente ou menor que 3 caracteres.`)
    }

    if (row.supplierName.trim().length < 2) {
      errors.push(`Linha ${rowNumber}: fornecedor ausente ou menor que 2 caracteres.`)
    }

    if (!Number.isFinite(row.purchasePrice) || row.purchasePrice <= 0) {
      errors.push(`Linha ${rowNumber}: valor de compra invalido.`)
    }

    if (!Number.isFinite(row.salePrice) || row.salePrice <= 0) {
      errors.push(`Linha ${rowNumber}: valor de venda invalido.`)
    }

    if (row.salePrice < row.purchasePrice) {
      errors.push(`Linha ${rowNumber}: valor de venda menor que valor de compra.`)
    }

    if (!Number.isInteger(row.stockQuantity) || row.stockQuantity < 0) {
      errors.push(`Linha ${rowNumber}: quantidade em estoque invalida.`)
    }

    if (!Number.isInteger(row.soldQuantity) || row.soldQuantity < 0) {
      errors.push(`Linha ${rowNumber}: quantidade de saida invalida.`)
    }

    if (row.boxNumber !== null && (!Number.isInteger(row.boxNumber) || row.boxNumber <= 0)) {
      warnings.push(`Linha ${rowNumber}: numero da caixa sera exportado em branco.`)
    }

    if (barcode) {
      if (barcodes.has(barcode)) {
        errors.push(`Linha ${rowNumber}: codigo de barras duplicado (${barcode}).`)
      }

      barcodes.add(barcode)
    }
  })

  return { errors, warnings }
}

function setFormulaCell(
  worksheet: XLSX.WorkSheet,
  address: string,
  formula: string,
  value: number,
  numberFormat: string,
  style: CellStyle = DATA_CELL_STYLE,
) {
  worksheet[address] = {
    t: "n",
    f: formula,
    v: value,
    z: numberFormat,
    s: {
      ...style,
      numFmt: numberFormat,
    },
  }
}

function setNumberFormat(worksheet: XLSX.WorkSheet, address: string, numberFormat: string) {
  const cell = worksheet[address]

  if (cell) {
    cell.z = numberFormat
    cell.s = {
      ...DATA_CELL_STYLE,
      numFmt: numberFormat,
    }
  }
}

function applyStyle(worksheet: XLSX.WorkSheet, address: string, style: CellStyle) {
  const cell = worksheet[address] ?? { t: "z" }

  cell.s = style
  worksheet[address] = cell
}

function applyRangeStyle(
  worksheet: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
  style: CellStyle,
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      applyStyle(worksheet, XLSX.utils.encode_cell({ r: row - 1, c: column - 1 }), style)
    }
  }
}

function applyNumberFormats(worksheet: XLSX.WorkSheet, rows: ProductControlExportRow[]) {
  rows.forEach((row, index) => {
    const excelRow = FIRST_DATA_ROW + index

    setNumberFormat(worksheet, `B${excelRow}`, INTEGER_FORMAT)
    setNumberFormat(worksheet, `G${excelRow}`, CURRENCY_FORMAT)
    setNumberFormat(worksheet, `H${excelRow}`, CURRENCY_FORMAT)
    setFormulaCell(worksheet, `I${excelRow}`, `H${excelRow}-G${excelRow}`, getProfit(row), CURRENCY_FORMAT)
    setNumberFormat(worksheet, `J${excelRow}`, INTEGER_FORMAT)
    setNumberFormat(worksheet, `K${excelRow}`, INTEGER_FORMAT)
    setFormulaCell(
      worksheet,
      `L${excelRow}`,
      `J${excelRow}-K${excelRow}`,
      row.stockQuantity,
      INTEGER_FORMAT,
    )
    setFormulaCell(
      worksheet,
      `M${excelRow}`,
      `PRODUCT(J${excelRow}*G${excelRow})`,
      roundMoney(getInitialStock(row) * row.purchasePrice),
      CURRENCY_FORMAT,
    )
    setFormulaCell(
      worksheet,
      `N${excelRow}`,
      `PRODUCT(J${excelRow}*H${excelRow})`,
      roundMoney(getInitialStock(row) * row.salePrice),
      CURRENCY_FORMAT,
    )
    setFormulaCell(
      worksheet,
      `O${excelRow}`,
      `N${excelRow}-M${excelRow}`,
      roundMoney(getInitialStock(row) * getProfit(row)),
      CURRENCY_FORMAT,
    )
  })
}

function buildTopRows(): WorkbookCellValue[][] {
  return [
    [
      null,
      "Controle de Produtos Diverse Shop DF",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "Valor Compra/ Venda Geral ",
      null,
      null,
      null,
      null,
    ],
    [],
    [],
    [
      null,
      "Item ",
      "Codigo de Barras ",
      "Descrição dos Produto ",
      "Numero da Caixa ",
      "Fornecedor ",
      "Valor de Compra ",
      "Valor de Venda ",
      "Lucro ",
      "Estoque ",
      "Saida ",
      "Quantidade em Estoque ",
      "Valor de Compra ",
      "Valor de Venda ",
      "Lucro ",
      null,
      null,
    ],
  ]
}

function buildDataRow(row: ProductControlExportRow, index: number): WorkbookCellValue[] {
  const initialStock = getInitialStock(row)

  return [
    null,
    index + 1,
    normalizeOptionalText(row.barcode),
    row.description,
    row.boxNumber && row.boxNumber > 0 ? row.boxNumber : null,
    row.supplierName,
    roundMoney(row.purchasePrice),
    roundMoney(row.salePrice),
    null,
    initialStock,
    row.soldQuantity,
    null,
    null,
    null,
    null,
    null,
    null,
  ]
}

function buildSummaryRows(): WorkbookCellValue[][] {
  return [
    [
      null,
      null,
      "Codigo de Barras ",
      "Descrição dos Produto ",
      "Numero da Caixa ",
      "Fornecedor ",
      "Valor de Compra ",
      "Valor de Venda ",
      "Lucro ",
      "Estoque ",
      "Saida ",
      "Quantidade em Estoque ",
      "Valor de Compra ",
      "Valor De Venda ",
      "lucro ",
      null,
      null,
    ],
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  ]
}

function applySummaryFormulas(
  worksheet: XLSX.WorkSheet,
  rows: ProductControlExportRow[],
  summaryValueRow: number,
) {
  const lastDataRow = FIRST_DATA_ROW + rows.length - 1

  setFormulaCell(
    worksheet,
    `G${summaryValueRow}`,
    `SUM(G${FIRST_DATA_ROW}:G${lastDataRow})`,
    roundMoney(rows.reduce((total, row) => total + row.purchasePrice, 0)),
    CURRENCY_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `H${summaryValueRow}`,
    `SUM(H${FIRST_DATA_ROW}:H${lastDataRow})`,
    roundMoney(rows.reduce((total, row) => total + row.salePrice, 0)),
    CURRENCY_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `I${summaryValueRow}`,
    `SUM(I${FIRST_DATA_ROW}:I${lastDataRow})`,
    roundMoney(rows.reduce((total, row) => total + getProfit(row), 0)),
    CURRENCY_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `J${summaryValueRow}`,
    `SUM(J${FIRST_DATA_ROW}:J${lastDataRow})`,
    rows.reduce((total, row) => total + getInitialStock(row), 0),
    INTEGER_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `K${summaryValueRow}`,
    `SUM(K${FIRST_DATA_ROW}:K${lastDataRow})`,
    rows.reduce((total, row) => total + row.soldQuantity, 0),
    INTEGER_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `L${summaryValueRow}`,
    `SUM(L${FIRST_DATA_ROW}:L${lastDataRow})`,
    rows.reduce((total, row) => total + row.stockQuantity, 0),
    INTEGER_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `M${summaryValueRow}`,
    `SUM(M${FIRST_DATA_ROW}:M${lastDataRow})`,
    roundMoney(rows.reduce((total, row) => total + getInitialStock(row) * row.purchasePrice, 0)),
    CURRENCY_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `N${summaryValueRow}`,
    `SUM(N${FIRST_DATA_ROW}:N${lastDataRow})`,
    roundMoney(rows.reduce((total, row) => total + getInitialStock(row) * row.salePrice, 0)),
    CURRENCY_FORMAT,
    SUMMARY_CELL_STYLE,
  )
  setFormulaCell(
    worksheet,
    `O${summaryValueRow}`,
    `SUM(O${FIRST_DATA_ROW}:O${lastDataRow})`,
    roundMoney(
      rows.reduce((total, row) => total + getInitialStock(row) * (row.salePrice - row.purchasePrice), 0),
    ),
    CURRENCY_FORMAT,
    SUMMARY_CELL_STYLE,
  )
}

export function createProductControlWorkbook(rows: ProductControlExportRow[]) {
  const summaryHeaderRow = FIRST_DATA_ROW + rows.length
  const summaryValueRow = summaryHeaderRow + 1
  const trailingRows = Array.from({ length: 13 }, () => [])
  const worksheetRows = [
    ...buildTopRows(),
    ...rows.map(buildDataRow),
    ...buildSummaryRows(),
    ...trailingRows,
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows, {
    cellDates: false,
  })
  const workbook = XLSX.utils.book_new()

  worksheet["!cols"] = ORIGINAL_COLUMNS
  worksheet["!merges"] = [
    { s: { c: 1, r: 0 }, e: { c: 10, r: 2 } },
    { s: { c: 11, r: 0 }, e: { c: 11, r: 2 } },
    { s: { c: 12, r: 0 }, e: { c: 14, r: 2 } },
  ]
  worksheet["!ref"] = `B1:Q${summaryValueRow + 13}`

  applyRangeStyle(worksheet, 1, 3, 2, 15, TOP_HEADER_STYLE)
  applyRangeStyle(worksheet, HEADER_ROW, HEADER_ROW, 2, 15, COLUMN_HEADER_STYLE)
  applyRangeStyle(worksheet, FIRST_DATA_ROW, FIRST_DATA_ROW + rows.length - 1, 2, 15, DATA_CELL_STYLE)
  applyRangeStyle(worksheet, summaryHeaderRow, summaryHeaderRow, 2, 15, COLUMN_HEADER_STYLE)
  applyRangeStyle(worksheet, summaryValueRow, summaryValueRow, 2, 15, SUMMARY_CELL_STYLE)
  applyNumberFormats(worksheet, rows)
  applySummaryFormulas(worksheet, rows, summaryValueRow)
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME)

  return workbook
}

export function writeProductControlWorkbook(rows: ProductControlExportRow[]) {
  const workbook = createProductControlWorkbook(rows)

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
    cellStyles: true,
  })
}

export const productControlWorkbookConfig = {
  sheetName: SHEET_NAME,
  headerRow: HEADER_ROW,
  firstDataRow: FIRST_DATA_ROW,
}
