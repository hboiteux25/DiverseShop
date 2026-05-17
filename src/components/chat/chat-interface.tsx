"use client"

import { FormEvent, ReactNode, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react"

import { ProductConfirmCard } from "@/components/chat/product-confirm-card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { productSchema, type ProductFormData } from "@/lib/validations/product"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  product?: ProductFormData
}

type ChatInterfaceProps = {
  compact?: boolean
  className?: string
}

const QUICK_ACTIONS = [
  "Cadastrar produto",
  "Ver estoque crítico",
  "Lista de reposição",
  "Resumo do dia",
]

const PRODUCT_CONFIRM_REGEX = /PRODUCT_CONFIRM_START\s*([\s\S]*?)\s*PRODUCT_CONFIRM_END/g

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseProductConfirm(content: string) {
  const match = PRODUCT_CONFIRM_REGEX.exec(content)
  PRODUCT_CONFIRM_REGEX.lastIndex = 0

  if (!match?.[1]) {
    return null
  }

  try {
    const parsedJson: unknown = JSON.parse(match[1])
    const parsedProduct = productSchema.safeParse(parsedJson)
    return parsedProduct.success ? parsedProduct.data : null
  } catch {
    return null
  }
}

function getVisibleContent(content: string) {
  return content.replace(PRODUCT_CONFIRM_REGEX, "").trim()
}

function renderInlineMarkdown(text: string) {
  const pieces = text.split(/(\*\*[^*]+\*\*)/g)

  return pieces.map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return (
        <strong key={`${piece}-${index}`} className="font-semibold">
          {piece.slice(2, -2)}
        </strong>
      )
    }

    return <span key={`${piece}-${index}`}>{piece}</span>
  })
}

function MarkdownMessage({ content }: { content: string }) {
  const visibleContent = getVisibleContent(content)
  const lines = visibleContent.split("\n")
  const nodes: ReactNode[] = []
  let listItems: string[] = []
  let codeLines: string[] = []
  let isCodeBlock = false

  function flushList() {
    if (listItems.length === 0) {
      return
    }

    nodes.push(
      <ul key={`list-${nodes.length}`} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    )
    listItems = []
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith("```")) {
      if (isCodeBlock) {
        nodes.push(
          <pre
            key={`code-${index}`}
            className="my-2 overflow-x-auto rounded-xl bg-black/30 p-3 font-mono text-xs text-white"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>,
        )
        codeLines = []
        isCodeBlock = false
      } else {
        flushList()
        isCodeBlock = true
      }

      return
    }

    if (isCodeBlock) {
      codeLines.push(line)
      return
    }

    if (trimmedLine.startsWith("- ")) {
      listItems.push(trimmedLine.slice(2))
      return
    }

    flushList()

    if (trimmedLine.length === 0) {
      nodes.push(<div key={`space-${index}`} className="h-2" />)
      return
    }

    nodes.push(
      <p key={`${trimmedLine}-${index}`} className="leading-relaxed">
        {renderInlineMarkdown(trimmedLine)}
      </p>,
    )
  })

  flushList()

  if (codeLines.length > 0) {
    nodes.push(
      <pre
        key="code-open"
        className="my-2 overflow-x-auto rounded-xl bg-black/30 p-3 font-mono text-xs text-white"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>,
    )
  }

  return <div className="space-y-1">{nodes}</div>
}

export function useChatStream() {
  const pathname = usePathname()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function sendMessage(content: string) {
    const trimmedContent = content.trim()

    if (!trimmedContent || isStreaming) {
      return
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedContent,
    }
    const assistantMessageId = createMessageId()
    const previousMessages = [...messages, userMessage]

    setMessages([
      ...previousMessages,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      },
    ])
    setIsStreaming(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: previousMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          context: {
            pathname,
          },
        }),
        signal: abortController.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error("Chat indisponível.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""

      while (true) {
        const readResult = await reader.read()

        if (readResult.done) {
          break
        }

        assistantContent += decoder.decode(readResult.value, { stream: true })
        const product = parseProductConfirm(assistantContent)

        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: assistantContent,
                  product: product ?? undefined,
                }
              : message,
          ),
        )
      }
    } catch {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: "Não consegui responder agora. Confira sua conexão e tente novamente.",
              }
            : message,
        ),
      )
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  return {
    messages,
    isStreaming,
    sendMessage,
  }
}

export function ChatInterface({ compact = false, className }: ChatInterfaceProps) {
  const { messages, isStreaming, sendMessage } = useChatStream()
  const [inputValue, setInputValue] = useState("")
  const hasMessages = messages.length > 0

  const welcomeMessage = useMemo(
    () =>
      compact
        ? "Posso ajudar com cadastro de produtos, estoque crítico e lista de reposição."
        : "Use o assistente para cadastrar produtos com conversa guiada, consultar estoque e montar pedidos de reposição.",
    [compact],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = inputValue
    setInputValue("")
    await sendMessage(value)
  }

  return (
    <section
      className={cn(
        "flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        compact && "h-full min-h-0 rounded-none border-0 shadow-none",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-white via-indigo-50 to-sky-50 px-4 py-4">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
          <Bot className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-950">Assistente IA</h2>
          <p className="truncate text-sm text-slate-600">{welcomeMessage}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-5">
        {!hasMessages ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Sparkles className="size-4 text-indigo-600" />
              Ações rápidas
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-start border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                  onClick={() => sendMessage(action)}
                  disabled={isStreaming}
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === "user"

          return (
            <div key={message.id} className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
              {!isUser ? (
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white">
                  <Bot className="size-4" />
                </div>
              ) : null}
              <div className={cn("max-w-[86%]", compact && "max-w-[90%]")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm shadow-sm",
                    isUser
                      ? "rounded-br-md bg-indigo-600 text-white"
                      : "rounded-bl-md bg-zinc-800 text-white",
                  )}
                >
                  {message.content ? (
                    <MarkdownMessage content={message.content} />
                  ) : (
                    <span className="inline-flex items-center gap-2 text-white/80">
                      <Loader2 className="size-4 animate-spin" />
                      digitando...
                    </span>
                  )}
                </div>
                {!isUser && message.product ? (
                  <ProductConfirmCard
                    product={message.product}
                    onDone={(feedbackMessage) => sendMessage(feedbackMessage)}
                    onEdit={() => sendMessage("Quero editar os dados desse produto antes de salvar.")}
                  />
                ) : null}
              </div>
              {isUser ? (
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <User className="size-4" />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Digite sua mensagem..."
            className="min-h-12 resize-none border-slate-200 text-base focus-visible:ring-indigo-500"
            disabled={isStreaming}
          />
          <Button
            type="submit"
            size="icon-lg"
            className="gradient-primary shrink-0 text-white shadow-sm"
            disabled={isStreaming || inputValue.trim().length === 0}
            aria-label="Enviar mensagem"
          >
            {isStreaming ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </Button>
        </div>
      </form>
    </section>
  )
}
