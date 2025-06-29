import type { InfiniteData } from '@tanstack/react-query'
import type { AppRouter } from '@tavern/api'
import type { inferRouterOutputs } from '@trpc/server'
import { useCallback, useEffect, useMemo } from 'react'
import {
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { getCharFirstMessages, randomPickCharFirstMessage, substituteParams } from '@tavern/core'
import { atom, useAtom } from 'jotai'
import { toast } from 'sonner'

import { useActive } from '@/hooks/use-active'
import { useCharacters } from '@/hooks/use-character'
import { useCharacterGroups } from '@/hooks/use-character-group'
import { useActiveCharacterOrGroup } from '@/hooks/use-character-or-group'
import { useTRPC } from '@/trpc/client'

type RouterOutput = inferRouterOutputs<AppRouter>
type ChatListOutput = RouterOutput['chat']['list']
export type Chat = ChatListOutput['chats'][number]

const PAGE_SIZE = 10

const activeChatIdAtom = atom<string | undefined>(undefined)

export function useActiveChatId() {
  const [activeChatId, setActiveChat] = useAtom(activeChatIdAtom)
  return {
    activeChatId,
    setActiveChat,
  }
}

export function useActiveChat() {
  const { activeChatId, setActiveChat } = useActiveChatId()

  const activeCharOrGroup = useActiveCharacterOrGroup()
  const { data: chats, isSuccess } = useChatsByCharacterOrGroup(activeCharOrGroup?.id)

  useEffect(() => {
    const id = chats?.pages[0]?.chats[0]?.id
    setActiveChat(id)
  }, [chats, setActiveChat])

  const activeChat = useMemo(() => {
    if (!isSuccess || !activeChatId) return undefined
    return chats.pages.flatMap((page) => page.chats).find((chat) => chat.id === activeChatId)
  }, [activeChatId, chats, isSuccess])

  const bypassGet = true

  const trpc = useTRPC()

  const { data: activeChat2, refetch } = useQuery({
    ...trpc.chat.get.queryOptions(
      activeChatId &&
        isSuccess &&
        !activeChat &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        !bypassGet
        ? {
            id: activeChatId,
          }
        : skipToken,
    ),
  })

  return {
    activeChat: activeChat ?? activeChat2?.chat,
    refetchActiveChat: refetch,
  }
}

export function useChats() {
  const trpc = useTRPC()

  return useInfiniteQuery(
    trpc.chat.list.infiniteQueryOptions(
      {
        limit: PAGE_SIZE,
      },
      {
        getNextPageParam: (lastPage) => {
          if (!lastPage.hasMore) return undefined
          return lastPage.cursor
        },
        // placeholderData: keepPreviousData,
      },
    ),
  )
}

export function useChatsByCharacter(characterId?: string) {
  const trpc = useTRPC()

  return useInfiniteQuery(
    trpc.chat.listByCharacter.infiniteQueryOptions(
      characterId
        ? {
            characterId,
            limit: PAGE_SIZE,
          }
        : skipToken,
      {
        getNextPageParam: (lastPage) => {
          if (!lastPage.hasMore) return undefined
          return lastPage.cursor
        },
      },
    ),
  )
}

export function useChatsByGroup(groupId?: string) {
  const trpc = useTRPC()

  return useInfiniteQuery(
    trpc.chat.listByGroup.infiniteQueryOptions(
      groupId
        ? {
            groupId,
            limit: PAGE_SIZE,
          }
        : skipToken,
      {
        getNextPageParam: (lastPage) => {
          if (!lastPage.hasMore) return undefined
          return lastPage.cursor
        },
      },
    ),
  )
}

export function useChatsByCharacterOrGroup(characterOrGroupId?: string) {
  const { characters } = useCharacters()

  const isCharacter = useMemo(
    () => characters.some((char) => char.id === characterOrGroupId),
    [characters, characterOrGroupId],
  )

  const characterChats = useChatsByCharacter(isCharacter ? characterOrGroupId : undefined)
  const groupChats = useChatsByGroup(!isCharacter ? characterOrGroupId : undefined)

  return isCharacter ? characterChats : groupChats
}

export function useCreateChat() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { characters } = useCharacters()
  const { groups } = useCharacterGroups()

  // Helper function to update chat lists with new chat
  const updateChatLists = (newChat: Chat) => {
    const updateChatList = (queryKey: unknown[]) => {
      queryClient.setQueryData<InfiniteData<ChatListOutput>>(queryKey, (old) => {
        if (!old?.pages[0]) {
          return {
            pages: [
              {
                chats: [newChat],
                hasMore: false,
                cursor: undefined,
              },
            ],
            pageParams: [undefined],
          }
        }

        const firstPage = old.pages[0]

        return {
          ...old,
          pages: [
            {
              ...firstPage,
              chats: [newChat, ...firstPage.chats],
            },
            ...old.pages.slice(1),
          ],
        }
      })
    }

    // Update all relevant chat lists
    updateChatList(
      trpc.chat.list.infiniteQueryKey({
        limit: PAGE_SIZE,
      }),
    )
    if (newChat.characterId) {
      updateChatList(
        trpc.chat.listByCharacter.infiniteQueryKey({
          characterId: newChat.characterId,
          limit: PAGE_SIZE,
        }),
      )
    }
    if (newChat.groupId) {
      updateChatList(
        trpc.chat.listByGroup.infiniteQueryKey({
          groupId: newChat.groupId,
          limit: PAGE_SIZE,
        }),
      )
    }
  }

  const createForCharacterMutation = useMutation(
    trpc.chat.createForCharacter.mutationOptions({
      onSuccess: (data) => {
        // Convert the mutation result to ChatItem type
        const chatItem: Chat = {
          ...data.chat,
          groupId: undefined,
        }
        updateChatLists(chatItem)
      },
      onError: (error) => {
        toast.error(`Failed to create chat: ${error.message}`)
      },
    }),
  )

  const createForGroupMutation = useMutation(
    trpc.chat.createForGroup.mutationOptions({
      onSuccess: (data) => {
        // Convert the mutation result to ChatItem type
        const chatItem: Chat = {
          ...data.chat,
          characterId: undefined,
        }
        updateChatLists(chatItem)
      },
      onError: (error) => {
        toast.error(`Failed to create chat: ${error.message}`)
      },
    }),
  )

  const { settings, modelPreset, model, charOrGroup, persona } = useActive()

  return useCallback(
    async (charOrGroupId: string, chatId?: string): Promise<{ chat: Chat } | undefined> => {
      if (!model || !charOrGroup || !persona) {
        return
      }

      const character = characters.find((c) => c.id === charOrGroupId)
      if (character) {
        const { evaluateMacros } = substituteParams({
          settings,
          modelPreset,
          model,
          persona,
          character: character.content,
        })

        const firstMsgs = getCharFirstMessages(character)

        const initialMessages = firstMsgs.map((firstMsg) => {
          return [
            {
              role: 'assistant',
              content: {
                parts: [
                  {
                    type: 'text',
                    text: evaluateMacros(firstMsg),
                  },
                ],
                annotations: [
                  {
                    characterId: character.id,
                  },
                ],
              },
            },
          ]
        })

        return await createForCharacterMutation.mutateAsync({
          characterId: charOrGroupId,
          id: chatId,
          // @ts-ignore
          initialMessages,
        })
      }

      const group = groups.find((g) => g.id === charOrGroupId)
      if (group) {
        const initialMessages = [
          group.characters
            .map((character) => {
              const { evaluateMacros } = substituteParams({
                settings,
                modelPreset,
                model,
                persona,
                character: character.content,
                group,
              })

              const firstMsg = randomPickCharFirstMessage(character)
              if (!firstMsg) {
                return
              }
              return {
                role: 'assistant' as const,
                content: {
                  parts: [
                    {
                      type: 'text' as const,
                      text: evaluateMacros(firstMsg),
                    },
                  ],
                  annotations: [
                    {
                      characterId: character.id,
                    },
                  ],
                },
              }
            })
            .filter((message): message is NonNullable<typeof message> => !!message),
        ]

        return await createForGroupMutation.mutateAsync({
          groupId: charOrGroupId,
          id: chatId,
          // @ts-ignore
          initialMessages,
        })
      }

      console.error('Invalid id: neither a character nor a group')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [characters, groups, settings, modelPreset, model, charOrGroup, persona],
  )
}

const hasAttemptedCreateAtom = atom(false)

export function useCreateFirstChatIfAbsent() {
  const { setActiveChat } = useActiveChatId()

  const activeCharOrGroup = useActiveCharacterOrGroup()
  const { data: chats, isSuccess } = useChatsByCharacterOrGroup(activeCharOrGroup?.id)

  const createChat = useCreateChat()

  const [hasAttemptedCreate, setHasAttemptedCreate] = useAtom(hasAttemptedCreateAtom)

  useEffect(() => {
    const id = chats?.pages[0]?.chats[0]?.id
    if (activeCharOrGroup && isSuccess && !id && !hasAttemptedCreate) {
      setHasAttemptedCreate(true)
      void createChat(activeCharOrGroup.id).finally(() => {
        setHasAttemptedCreate(false)
      })
    }
    setActiveChat(id)
  }, [
    activeCharOrGroup,
    chats,
    isSuccess,
    createChat,
    setActiveChat,
    hasAttemptedCreate,
    setHasAttemptedCreate,
  ])
}

export function useUpdateChat(characterId?: string, groupId?: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const updateMutation = useMutation(
    trpc.chat.update.mutationOptions({
      onMutate: async (newData) => {
        // Cancel any outgoing refetches for all chat list queries
        await Promise.all([
          queryClient.cancelQueries({
            queryKey: trpc.chat.list.infiniteQueryKey({
              limit: PAGE_SIZE,
            }),
          }),
          characterId &&
            queryClient.cancelQueries({
              queryKey: trpc.chat.listByCharacter.infiniteQueryKey({
                characterId,
                limit: PAGE_SIZE,
              }),
            }),
          groupId &&
            queryClient.cancelQueries({
              queryKey: trpc.chat.listByGroup.infiniteQueryKey({
                groupId,
                limit: PAGE_SIZE,
              }),
            }),
        ])

        // Snapshot the previous values
        const previousData = {
          list: queryClient.getQueryData<InfiniteData<ChatListOutput>>(
            trpc.chat.list.infiniteQueryKey({
              limit: PAGE_SIZE,
            }),
          ),
          listByCharacter: characterId
            ? queryClient.getQueryData<InfiniteData<ChatListOutput>>(
                trpc.chat.listByCharacter.infiniteQueryKey({
                  characterId,
                  limit: PAGE_SIZE,
                }),
              )
            : undefined,
          listByGroup: groupId
            ? queryClient.getQueryData<InfiniteData<ChatListOutput>>(
                trpc.chat.listByGroup.infiniteQueryKey({
                  groupId,
                  limit: PAGE_SIZE,
                }),
              )
            : undefined,
        }

        // Helper function to update chat list
        const updateChatList = (queryKey: unknown[]) => {
          queryClient.setQueryData<InfiniteData<ChatListOutput>>(queryKey, (old) => {
            if (!old) {
              return undefined
            }
            return {
              pages: old.pages.map((page) => ({
                ...page,
                chats: page.chats.map((chat) =>
                  chat.id === newData.id ? { ...chat, ...newData } : chat,
                ),
              })),
              pageParams: old.pageParams,
            }
          })
        }

        // Optimistically update all chat lists
        updateChatList(
          trpc.chat.list.infiniteQueryKey({
            limit: PAGE_SIZE,
          }),
        )
        if (characterId) {
          updateChatList(
            trpc.chat.listByCharacter.infiniteQueryKey({
              characterId,
              limit: PAGE_SIZE,
            }),
          )
        }
        if (groupId) {
          updateChatList(
            trpc.chat.listByGroup.infiniteQueryKey({
              groupId,
              limit: PAGE_SIZE,
            }),
          )
        }

        return { previousData }
      },
      onError: (error, newData, context) => {
        // Rollback on error for all chat lists
        if (context?.previousData) {
          if (context.previousData.list) {
            queryClient.setQueryData<InfiniteData<ChatListOutput>>(
              trpc.chat.list.infiniteQueryKey({
                limit: PAGE_SIZE,
              }),
              context.previousData.list,
            )
          }
          if (context.previousData.listByCharacter && characterId) {
            queryClient.setQueryData<InfiniteData<ChatListOutput>>(
              trpc.chat.listByCharacter.infiniteQueryKey({
                characterId,
                limit: PAGE_SIZE,
              }),
              context.previousData.listByCharacter,
            )
          }
          if (context.previousData.listByGroup && groupId) {
            queryClient.setQueryData<InfiniteData<ChatListOutput>>(
              trpc.chat.listByGroup.infiniteQueryKey({
                groupId,
                limit: PAGE_SIZE,
              }),
              context.previousData.listByGroup,
            )
          }
        }
        toast.error(`Failed to update chat: ${error.message}`)
      },
    }),
  )

  return useCallback(
    async (id: string, data: Partial<Chat>) => {
      return await updateMutation.mutateAsync({
        id,
        ...data,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}

export function useDeleteChat(characterId?: string, groupId?: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation(
    trpc.chat.delete.mutationOptions({
      onMutate: async (newData) => {
        // Cancel any outgoing refetches for all chat list queries
        await Promise.all([
          queryClient.cancelQueries({
            queryKey: trpc.chat.list.infiniteQueryKey({
              limit: PAGE_SIZE,
            }),
          }),
          characterId &&
            queryClient.cancelQueries({
              queryKey: trpc.chat.listByCharacter.infiniteQueryKey({
                characterId,
                limit: PAGE_SIZE,
              }),
            }),
          groupId &&
            queryClient.cancelQueries({
              queryKey: trpc.chat.listByGroup.infiniteQueryKey({
                groupId,
                limit: PAGE_SIZE,
              }),
            }),
        ])

        // Snapshot the previous values
        const previousData = {
          list: queryClient.getQueryData<InfiniteData<ChatListOutput>>(
            trpc.chat.list.infiniteQueryKey({
              limit: PAGE_SIZE,
            }),
          ),
          listByCharacter: characterId
            ? queryClient.getQueryData<InfiniteData<ChatListOutput>>(
                trpc.chat.listByCharacter.infiniteQueryKey({
                  characterId,
                  limit: PAGE_SIZE,
                }),
              )
            : undefined,
          listByGroup: groupId
            ? queryClient.getQueryData<InfiniteData<ChatListOutput>>(
                trpc.chat.listByGroup.infiniteQueryKey({
                  groupId,
                  limit: PAGE_SIZE,
                }),
              )
            : undefined,
        }

        // Helper function to update chat list
        const updateChatList = (queryKey: unknown[]) => {
          queryClient.setQueryData<InfiniteData<ChatListOutput>>(queryKey, (old) => {
            if (!old) {
              return undefined
            }
            return {
              pages: old.pages.map((page) => ({
                ...page,
                chats: page.chats.filter((chat) => chat.id !== newData.id),
              })),
              pageParams: old.pageParams,
            }
          })
        }

        // Optimistically update all chat lists
        updateChatList(
          trpc.chat.list.infiniteQueryKey({
            limit: PAGE_SIZE,
          }),
        )
        if (characterId) {
          updateChatList(
            trpc.chat.listByCharacter.infiniteQueryKey({
              characterId,
              limit: PAGE_SIZE,
            }),
          )
        }
        if (groupId) {
          updateChatList(
            trpc.chat.listByGroup.infiniteQueryKey({
              groupId,
              limit: PAGE_SIZE,
            }),
          )
        }

        return { previousData }
      },
      onError: (error, newData, context) => {
        // Rollback on error for all chat lists
        if (context?.previousData) {
          if (context.previousData.list) {
            queryClient.setQueryData<InfiniteData<ChatListOutput>>(
              trpc.chat.list.infiniteQueryKey({
                limit: PAGE_SIZE,
              }),
              context.previousData.list,
            )
          }
          if (context.previousData.listByCharacter && characterId) {
            queryClient.setQueryData<InfiniteData<ChatListOutput>>(
              trpc.chat.listByCharacter.infiniteQueryKey({
                characterId,
                limit: PAGE_SIZE,
              }),
              context.previousData.listByCharacter,
            )
          }
          if (context.previousData.listByGroup && groupId) {
            queryClient.setQueryData<InfiniteData<ChatListOutput>>(
              trpc.chat.listByGroup.infiniteQueryKey({
                groupId,
                limit: PAGE_SIZE,
              }),
              context.previousData.listByGroup,
            )
          }
        }
        toast.error(`Failed to delete chat: ${error.message}`)
      },
    }),
  )

  return useCallback(
    async (id: string) => {
      return await deleteMutation.mutateAsync({
        id,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}
