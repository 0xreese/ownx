import type { Message } from 'ai'
import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { Artifact } from '@ownxai/db/schema'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ApplicationError extends Error {
  info: string
  status: number
}

export const fetcher = async (url: string) => {
  const res = await fetch(url)

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.') as ApplicationError

    error.info = await res.json()
    error.status = res.status

    throw error
  }

  return res.json()
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]')
  }
  return []
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function sanitizeUIMessages(messages: Message[]): Message[] {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== 'assistant') return message

    if (!message.toolInvocations) return message

    const toolResultIds: string[] = []

    for (const toolInvocation of message.toolInvocations) {
      if (toolInvocation.state === 'result') {
        toolResultIds.push(toolInvocation.toolCallId)
      }
    }

    const sanitizedToolInvocations = message.toolInvocations.filter(
      (toolInvocation) =>
        toolInvocation.state === 'result' || toolResultIds.includes(toolInvocation.toolCallId),
    )

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    }
  })

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      message.content.length > 0 || (message.toolInvocations && message.toolInvocations.length > 0),
  )
}

export function getDocumentTimestampByIndex(documents: Artifact[], index: number) {
  return documents.at(index)?.createdAt ?? new Date()
}
