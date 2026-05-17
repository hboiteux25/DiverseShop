import { ChatInterface } from "@/components/chat/chat-interface"

export default function ChatPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-indigo-600">Assistente operacional</p>
        <h1 className="text-2xl font-bold text-slate-950">Chat IA</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cadastre produtos por conversa, consulte estoque e monte listas de reposição.
        </p>
      </div>
      <ChatInterface />
    </main>
  )
}
