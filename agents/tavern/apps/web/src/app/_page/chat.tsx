import type { Message, MessageContent, MessageNode } from '@tavern/core'
import type { UIMessage } from 'ai'
import type { VListHandle } from 'virtua'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { buildPromptMessages } from '@tavern/core'
import hash from 'stable-hash'

import { generateMessageId } from '@ownxai/sdk'

import type { MessageTree } from './messages'
import { useActive } from '@/hooks/use-active'
import { isCharacter, isCharacterGroup } from '@/hooks/use-character-or-group'
import { useCachedMessage, useMessages } from '@/hooks/use-message'
import { ContentArea } from './content-area'
import { useCallWhenGenerating } from './hooks'
import { buildMessageTree, Messages } from './messages'
import { MultimodalInput } from './multimodal-input'

export function Chat() {
  const { settings, modelPreset, model, charOrGroup, persona, chat } = useActive()

  const chatId = chat?.id

  const { data, isLoading, isSuccess, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(chatId)

  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false)

  useEffect(() => {
    void (async function () {
      if (hasNextPage && !isFetchingNextPage && !isLoading && !hasAttemptedFetch) {
        console.log('Fetching messages...')
        setHasAttemptedFetch(true)
        await fetchNextPage().finally(() => setHasAttemptedFetch(false))
      }
    })()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, hasAttemptedFetch])

  const [tree, setTree] = useState<MessageTree>()
  const [branch, setBranch] = useState<MessageNode[]>([])
  const treeRef = useRef<MessageTree>(undefined)
  const branchRef = useRef<MessageNode[]>([])

  useEffect(() => {
    treeRef.current =
      isSuccess && !hasNextPage
        ? buildMessageTree(data.pages.flatMap((page) => page.messages))
        : undefined

    branchRef.current = (() => {
      if (!treeRef.current) {
        return []
      }
      const nodes: MessageNode[] = []
      let current: MessageNode | undefined = treeRef.current.latest
      while (current) {
        nodes.push(current)
        current = current.parent
      }
      return nodes.reverse()
    })()

    setTree((oldTree) => {
      const newTree = treeRef.current
      if (newTree && oldTree && !newTree.isChanged(oldTree.allMessages)) {
        return oldTree
      }
      setBranch(branchRef.current)
      return newTree
    })
  }, [data, hasNextPage, isSuccess])

  const navigate = useCallback(
    (current: MessageNode, previous: boolean) => {
      if (!tree) {
        return
      }
      const isRoot = tree.tree.find((node) => node === current)
      const siblings = isRoot ? tree.tree : current.parent?.descendants

      const index = siblings?.findIndex((node) => node === current)
      if (index === undefined || index < 0) {
        return
      }
      const newIndex = previous ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= (siblings?.length ?? 0)) {
        return
      }
      const newCurrent = siblings?.[newIndex]
      if (!newCurrent) {
        return
      }

      if (isRoot) {
        const nodes = []
        let c: MessageNode | undefined = newCurrent
        while (c) {
          nodes.push(c)
          let latest: MessageNode | undefined = undefined
          let maxId = ''
          for (const child of c.descendants) {
            if (!maxId || child.message.id > maxId) {
              latest = child
              maxId = child.message.id
            }
          }
          c = latest
        }
        setBranch(nodes)
        return
      }

      setBranch((branch) => {
        const position = branch.findIndex((m) => m === current)
        if (position < 0) {
          return branch
        }
        const newBranch = [...branch.slice(0, position)]
        let next: MessageNode | undefined = newCurrent
        while (next) {
          newBranch.push(next)
          next = next.descendants.reduce((latest, node) => {
            return !latest || latest.message.id < node.message.id ? node : latest
          }, next.descendants[0])
        }
        return newBranch
      })
    },
    [tree],
  )

  const { addCachedMessage, updateCachedMessage } = useCachedMessage(chatId)

  const prepareRequestBody = useCallback(
    ({ id, messages: uiMessages }: { id: string; messages: UIMessage[] }) => {
      if (!chat || !model || !persona || !charOrGroup) {
        throw new Error('Not initialized')
      }

      const lastUiMessage = uiMessages[uiMessages.length - 1]
      if (!lastUiMessage) {
        throw new Error('No messages')
      }

      let content = {
        parts: lastUiMessage.parts,
        experimental_attachments: lastUiMessage.experimental_attachments,
      } as MessageContent

      const messages = branch.map((node) => node.message)
      const last = messages[messages.length - 1]
      const secondLast = messages[messages.length - 2]

      let lastMessage: Message

      if (lastUiMessage.id === last?.id || lastUiMessage.id === secondLast?.id) {
        let msg = {} as Message
        if (lastUiMessage.id === last?.id) {
          msg = last
        } else if (lastUiMessage.id === secondLast?.id) {
          msg = secondLast
          // Remove the last message
          messages.splice(messages.length - 1, 1)
        }

        content = {
          ...content,
          annotations: [
            {
              // TODO
              characterId: isCharacter(charOrGroup)
                ? charOrGroup.id
                : charOrGroup.characters[0]?.id,
              modelId: model.id,
            },
          ],
        }

        lastMessage = {
          ...msg,
          content,
        }
        messages[messages.length - 1] = lastMessage
        updateCachedMessage(lastMessage)
      } else {
        content = {
          ...content,
          annotations: [
            {
              personaId: persona.id,
              personaName: persona.name,
            },
          ],
        }

        lastMessage = {
          id: lastUiMessage.id,
          chatId: id,
          parentId: last?.id ?? null,
          role: lastUiMessage.role as any,
          content,
          createdAt: lastUiMessage.createdAt ?? new Date(),
        } as Message
        messages.push(lastMessage)
        addCachedMessage(lastMessage)
      }

      // TODO
      const nextChar = isCharacter(charOrGroup) ? charOrGroup : charOrGroup.characters[0]
      if (!nextChar) {
        throw new Error('No character')
      }

      const promptMessages = buildPromptMessages({
        messages,
        branch, // TODO
        chat,
        settings,
        modelPreset,
        model,
        persona,
        character: nextChar.content,
        group: isCharacterGroup(charOrGroup) ? charOrGroup : undefined,
      })

      return {
        id,
        messages: promptMessages,
        lastMessage,
        characterId: nextChar.id,
        modelId: model.id,
      }
    },
    [
      chat,
      branch,
      model,
      settings,
      modelPreset,
      charOrGroup,
      updateCachedMessage,
      persona,
      addCachedMessage,
    ],
  )

  const { messages, setMessages, handleSubmit, input, setInput, append, status, stop } = useChat({
    id: chatId,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateMessageId,
    experimental_prepareRequestBody: prepareRequestBody,
    onFinish: (...args) => console.log('onFinish', ...args),
    onError: (error) => console.error('onError', error),
  })

  useEffect(() => {
    const lastUiMessage = messages[messages.length - 1]
    if (lastUiMessage?.role !== 'assistant') {
      return
    }

    const msgs = branch.map((node) => node.message)
    const last = msgs[msgs.length - 1]

    const content = {
      parts: lastUiMessage.parts,
      experimental_attachments: lastUiMessage.experimental_attachments,
      annotations: [
        {
          // TODO
          characterId: isCharacter(charOrGroup) ? charOrGroup.id : charOrGroup?.characters[0]?.id,
          modelId: model?.id,
        },
      ],
    } as MessageContent

    if (!last || lastUiMessage.id > last.id) {
      addCachedMessage({
        id: lastUiMessage.id,
        chatId: chatId,
        parentId: last?.id ?? null,
        role: lastUiMessage.role as any,
        content,
        createdAt: lastUiMessage.createdAt ?? new Date(),
      } as Message)
    } else if (lastUiMessage.id === last.id && hash(content) !== hash(last.content)) {
      updateCachedMessage({
        ...last,
        content,
      })
    }

    if (status === 'ready' || status === 'error') {
      setMessages([])
    }
  }, [
    branch,
    messages,
    setMessages,
    status,
    persona,
    charOrGroup,
    model,
    chatId,
    addCachedMessage,
    updateCachedMessage,
  ])

  const ref = useRef<VListHandle>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((smooth?: boolean) => {
    // There always exists a `div` at the end of the list, so we can scroll to it.
    const index = branchRef.current.length
    ref.current?.scrollToIndex(index, {
      align: 'end',
      // Using smooth scrolling over many items can kill performance benefit of virtual scroll.
      smooth: typeof smooth === 'boolean' ? smooth : true,
    })
  }, [])

  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false)
  useEffect(() => {
    if (isSuccess && !hasNextPage) {
      setShouldScrollToBottom(true)
    }
  }, [isSuccess, hasNextPage])
  useEffect(() => {
    if (shouldScrollToBottom) {
      // Scroll to bottom when the chat is loaded.
      scrollToBottom(false)
      setShouldScrollToBottom(false)
    }
  }, [scrollToBottom, shouldScrollToBottom])

  useCallWhenGenerating(
    chatId,
    status,
    useCallback(() => {
      // Always scroll to bottom when the message list changes.
      if (branch.length) {
        scrollToBottom()
      }
    }, [scrollToBottom, branch]),
  )

  return (
    <>
      <ContentArea>
        <Messages ref={ref} endRef={endRef} messages={branch} navigate={navigate} />
      </ContentArea>

      <MultimodalInput
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        messages={messages}
        setMessages={setMessages}
        append={append}
        handleSubmit={handleSubmit}
        scrollToBottom={scrollToBottom}
        disabled={isLoading}
      />
    </>
  )
}
