interface ProductEditPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ProductEditPage({ params }: ProductEditPageProps) {
  const { id } = await params

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Editar produto</h1>
      <p className="text-sm text-muted-foreground">Produto: {id}</p>
    </main>
  )
}
