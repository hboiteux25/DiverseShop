"use client"

import { MessageCircle } from "lucide-react"

import { ChatInterface } from "@/components/chat/chat-interface"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function ChatWidget() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          className="fixed bottom-5 right-5 z-40 size-14 rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 p-0 text-white shadow-xl shadow-indigo-200 hover:opacity-95"
          aria-label="Abrir assistente IA"
        >
          <MessageCircle className="size-6" />
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white ring-2 ring-white">
            3
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xl border-slate-200 bg-white p-0 sm:max-w-xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Assistente IA</SheetTitle>
          <SheetDescription>Chat lateral para suporte operacional da Diverse Shop DF.</SheetDescription>
        </SheetHeader>
        <ChatInterface compact />
      </SheetContent>
    </Sheet>
  )
}
