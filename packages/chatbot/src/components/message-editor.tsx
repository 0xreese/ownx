'use client'

import type { ChatRequestOptions, Message } from 'ai'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@ownxai/ui/components/button'
import { Textarea } from '@ownxai/ui/components/textarea'

import { useTRPC } from '@/lib/api'

export interface MessageEditorProps {
  message: Message
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>
  setMessages: (messages: Message[] | ((messages: Message[]) => Message[])) => void
  reload: (chatRequestOptions?: ChatRequestOptions) => Promise<string | null | undefined>
}

export function MessageEditor({ message, setMode, setMessages, reload }: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const [draftContent, setDraftContent] = useState<string>(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight()
    }
  }, [])

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`
    }
  }

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value)
    adjustHeight()
  }

  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const deleteTrailingMessages = useMutation(
    trpc.message.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.message.list.queryKey(),
        })
      },
      onError: (err) => {
        console.error(
          err.data?.code === 'UNAUTHORIZED'
            ? 'You must be logged in to update chat'
            : 'Failed to update chat',
        )
      },
    }),
  )

  return (
    <div className="flex flex-col gap-2 w-full">
      <Textarea
        ref={textareaRef}
        className="bg-transparent outline-none overflow-hidden resize-none !text-base rounded-xl w-full"
        value={draftContent}
        onChange={handleInput}
      />

      <div className="flex flex-row gap-2 justify-end">
        <Button
          variant="outline"
          className="h-fit py-2 px-3"
          onClick={() => {
            setMode('view')
          }}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          className="h-fit py-2 px-3"
          disabled={isSubmitting}
          onClick={() => {
            setIsSubmitting(true)

            deleteTrailingMessages.mutate({
              id: message.id,
              deleteTrailing: true,
              excludeSelf: true,
            })

            setMessages((messages) => {
              const index = messages.findIndex((m) => m.id === message.id)

              if (index !== -1) {
                const updatedMessage = {
                  ...message,
                  content: draftContent,
                }

                return [...messages.slice(0, index), updatedMessage]
              }

              return messages
            })

            setMode('view')
            void reload()
          }}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
