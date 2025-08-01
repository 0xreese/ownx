import { chatMetadataSchema, messageContentSchema } from '@tavern/core'
import { Character, CharacterChat, CharGroup, CharGroupChat } from '@tavern/db/schema'
import { TRPCError } from '@trpc/server'
import { format } from 'date-fns'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { z } from 'zod/v4'

import type { Chat as _Chat } from '@cared/sdk'

import { createCaredClient } from '../cared'
import { userProtectedProcedure } from '../trpc'

export type Chat = _Chat & {
  characterId?: string
  groupId?: string
}

export const chatRouter = {
  list: userProtectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      const { chats, hasMore, last } = await caredTrpc.chat.list.query({
        before: input.cursor,
        limit: input.limit,
        orderBy: 'desc',
        orderOn: 'updatedAt',
        includeLastMessage: true,
      })

      // Get all chat IDs
      const chatIds = chats.map((chat) => chat.id)

      // Query character chat records for these chat IDs
      const characterChats = await ctx.db
        .select({
          chatId: CharacterChat.chatId,
          characterId: CharacterChat.characterId,
        })
        .from(CharacterChat)
        .where(inArray(CharacterChat.chatId, chatIds))

      // Query group chat records for these chat IDs
      const groupChats = await ctx.db
        .select({
          chatId: CharGroupChat.chatId,
          groupId: CharGroupChat.groupId,
        })
        .from(CharGroupChat)
        .where(inArray(CharGroupChat.chatId, chatIds))

      // Create a mapping table: chat ID -> character ID or group ID
      const chatToCharacterMap = Object.fromEntries(
        characterChats.map((record) => [record.chatId, record.characterId]),
      )
      const chatToGroupMap = Object.fromEntries(
        groupChats.map((record) => [record.chatId, record.groupId]),
      )

      return {
        chats: chats.map((chat) => {
          const { id, metadata, createdAt, updatedAt, lastMessage } = chat
          return {
            id,
            metadata,
            createdAt,
            updatedAt,
            lastMessage,
            characterId: chatToCharacterMap[id],
            groupId: chatToGroupMap[id],
          } as Chat
        }),
        hasMore,
        cursor: last,
      }
    }),

  listByCharacter: userProtectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // First get chat IDs and timestamps from character chat table
      const characterChats = await ctx.db
        .select({ id: CharacterChat.chatId, updatedAt: CharacterChat.updatedAt })
        .from(CharacterChat)
        .where(
          and(
            eq(CharacterChat.characterId, input.characterId),
            eq(CharacterChat.userId, ctx.auth.userId),
            typeof input.cursor === 'string'
              ? lt(CharacterChat.updatedAt, z.coerce.date().parse(input.cursor))
              : undefined,
          ),
        )
        .orderBy(desc(CharacterChat.updatedAt))
        .limit(input.limit + 1)

      const hasMore = characterChats.length > input.limit
      if (hasMore) {
        characterChats.pop()
      }

      const cursor = characterChats[characterChats.length - 1]?.updatedAt.toISOString()

      // Get chat IDs for querying cared service
      const chatIds = characterChats.map((chat) => chat.id)

      // Fetch complete chat information from cared service
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      const chats = chatIds.length
        ? (
            await caredTrpc.chat.listByIds.query({
              ids: chatIds,
              includeLastMessage: true,
            })
          ).chats
        : []

      // Create a map of chat ID to chat data for easy lookup
      const chatMap = Object.fromEntries(chats.map((chat) => [chat.id, chat]))

      return {
        chats: characterChats.map((chat) => {
          const caredChat = chatMap[chat.id]
          if (!caredChat) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Chat data inconsistency between cared and local database',
            })
          }
          const { id, metadata, createdAt, updatedAt, lastMessage } = caredChat
          return {
            id,
            metadata,
            createdAt,
            updatedAt,
            lastMessage,
            characterId: input.characterId,
          } as Chat
        }),
        hasMore,
        cursor,
      }
    }),

  listByGroup: userProtectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // First get chat IDs and timestamps from group chat table
      const groupChats = await ctx.db
        .select({ id: CharGroupChat.chatId, updatedAt: CharGroupChat.updatedAt })
        .from(CharGroupChat)
        .where(
          and(
            eq(CharGroupChat.groupId, input.groupId),
            eq(CharGroupChat.userId, ctx.auth.userId),
            typeof input.cursor === 'string'
              ? lt(CharGroupChat.updatedAt, z.coerce.date().parse(input.cursor))
              : undefined,
          ),
        )
        .orderBy(desc(CharGroupChat.updatedAt))
        .limit(input.limit + 1)

      const hasMore = groupChats.length > input.limit
      if (hasMore) {
        groupChats.pop()
      }

      const cursor = groupChats[groupChats.length - 1]?.updatedAt.toISOString()

      // Get chat IDs for querying cared service
      const chatIds = groupChats.map((chat) => chat.id)

      // Fetch complete chat information from cared service
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      const chats = chatIds.length
        ? (
            await caredTrpc.chat.listByIds.query({
              ids: chatIds,
              includeLastMessage: true,
            })
          ).chats
        : []

      // Create a map of chat ID to chat data for easy lookup
      const chatMap = Object.fromEntries(chats.map((chat) => [chat.id, chat]))

      return {
        chats: groupChats.map((chat) => {
          const caredChat = chatMap[chat.id]
          if (!caredChat) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Chat data inconsistency between cared and local database',
            })
          }
          const { id, metadata, createdAt, updatedAt, lastMessage } = caredChat
          return {
            id,
            metadata,
            createdAt,
            updatedAt,
            lastMessage,
            groupId: input.groupId,
          } as Chat
        }),
        hasMore,
        cursor,
      }
    }),

  get: userProtectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      const chat = (
        await caredTrpc.chat.byId.query({
          id: input.id,
          includeLastMessage: true,
        })
      ).chat

      const characterChat = await ctx.db.query.CharacterChat.findFirst({
        columns: {
          characterId: true,
        },
        where: eq(CharacterChat.chatId, input.id),
      })

      const groupChat = await ctx.db.query.CharGroupChat.findFirst({
        columns: {
          groupId: true,
        },
        where: eq(CharGroupChat.chatId, input.id),
      })

      const { id, metadata, createdAt, updatedAt, lastMessage } = chat
      return {
        chat: {
          id,
          metadata,
          createdAt,
          updatedAt,
          lastMessage,
          characterId: characterChat?.characterId,
          groupId: groupChat?.groupId,
        } as Chat,
      }
    }),

  createForCharacter: userProtectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        id: z.string().optional(),
        initialMessages: z
          .array(
            z.array(
              z.object({
                id: z.string().optional(),
                role: z.enum(['system', 'user', 'assistant']),
                content: messageContentSchema,
              }),
            ),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      // Check if character exists and belongs to user
      const character = await ctx.db.query.Character.findFirst({
        where: and(eq(Character.id, input.characterId), eq(Character.userId, ctx.auth.userId)),
      })
      if (!character) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found',
        })
      }

      const chat = (
        await caredTrpc.chat.create.mutate({
          // If id is provided, it will be used; otherwise, a new id will be generated
          id: input.id,
          metadata: {
            title: `${character.content.data.name} - ${format(new Date(), "yyyy-MM-dd@HH'h'mm'm'ss's'")}`,
          },
          initialMessages: input.initialMessages,
          includeLastMessage: true,
        })
      ).chat

      await ctx.db.insert(CharacterChat).values({
        characterId: input.characterId,
        chatId: chat.id,
        userId: ctx.auth.userId,
      })

      const { id, metadata, createdAt, updatedAt, lastMessage } = chat
      return {
        chat: {
          id,
          metadata,
          createdAt,
          updatedAt,
          lastMessage,
          characterId: character.id,
        } as Chat,
      }
    }),

  createForGroup: userProtectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        id: z.string().optional(),
        initialMessages: z
          .array(
            z.array(
              z.object({
                id: z.string().optional(),
                role: z.enum(['system', 'user', 'assistant']),
                content: messageContentSchema,
              }),
            ),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      // Check if group exists and belongs to user
      const group = await ctx.db.query.CharGroup.findFirst({
        where: and(eq(CharGroup.id, input.groupId), eq(CharGroup.userId, ctx.auth.userId)),
      })
      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character group not found',
        })
      }

      const chat = (
        await caredTrpc.chat.create.mutate({
          // If id is provided, it will be used; otherwise, a new id will be generated
          id: input.id,
          metadata: {
            title: `${group.metadata.name} - ${format(new Date(), "yyyy-MM-dd@HH'h'mm'm'ss's'")}`,
          },
          initialMessages: input.initialMessages,
          includeLastMessage: true,
        })
      ).chat

      await ctx.db.insert(CharGroupChat).values({
        groupId: input.groupId,
        chatId: chat.id,
        userId: ctx.auth.userId,
      })

      const { id, metadata, createdAt, updatedAt, lastMessage } = chat
      return {
        chat: {
          id,
          metadata,
          createdAt,
          updatedAt,
          lastMessage,
          groupId: group.id,
        } as Chat,
      }
    }),

  update: userProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        metadata: chatMetadataSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      // Update field `updatedAt`
      const chat = (
        await caredTrpc.chat.update.mutate({
          id: input.id,
          ...(input.metadata && {
            metadata: {
              custom: input.metadata,
            },
          }),
        })
      ).chat

      await ctx.db
        .update(CharacterChat)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(CharacterChat.chatId, input.id))
      await ctx.db
        .update(CharGroupChat)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(CharGroupChat.chatId, input.id))

      const { id, metadata, createdAt, updatedAt } = chat
      return {
        chat: {
          id,
          metadata,
          createdAt,
          updatedAt,
        } as Chat,
      }
    }),

  delete: userProtectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      await ctx.db.transaction(async (tx) => {
        await tx.delete(CharacterChat).where(eq(CharacterChat.chatId, input.id))

        await tx.delete(CharGroupChat).where(eq(CharGroupChat.chatId, input.id))

        await caredTrpc.chat.delete.mutate({
          id: input.id,
        })
      })
    }),

  batchDelete: userProtectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(32)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      await ctx.db.transaction(async (tx) => {
        // Delete character chat records for all chat IDs
        await tx.delete(CharacterChat).where(inArray(CharacterChat.chatId, input.ids))

        // Delete group chat records for all chat IDs
        await tx.delete(CharGroupChat).where(inArray(CharGroupChat.chatId, input.ids))

        // Call cared batch delete
        await caredTrpc.chat.batchDelete.mutate({
          ids: input.ids,
        })
      })
    }),

  clone: userProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        messages: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cared = createCaredClient(ctx)
      const caredTrpc = cared.trpc

      // Check if user has access to this chat
      const characterChat = await ctx.db.query.CharacterChat.findFirst({
        where: and(eq(CharacterChat.chatId, input.id), eq(CharacterChat.userId, ctx.auth.userId)),
      })

      const groupChat = await ctx.db.query.CharGroupChat.findFirst({
        where: and(eq(CharGroupChat.chatId, input.id), eq(CharGroupChat.userId, ctx.auth.userId)),
      })

      if (!characterChat && !groupChat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        })
      }

      // Use cared SDK's clone functionality
      const { chat: newChat } = await caredTrpc.chat.clone.mutate({
        id: input.id,
        messages: input.messages,
        includeLastMessage: true,
      })

      // Link new chat to character or group if the original was linked
      if (characterChat) {
        await ctx.db.insert(CharacterChat).values({
          characterId: characterChat.characterId,
          chatId: newChat.id,
          userId: ctx.auth.userId,
        })
      }

      if (groupChat) {
        await ctx.db.insert(CharGroupChat).values({
          groupId: groupChat.groupId,
          chatId: newChat.id,
          userId: ctx.auth.userId,
        })
      }

      const { id, metadata, createdAt, updatedAt, lastMessage } = newChat
      return {
        chat: {
          id,
          metadata,
          createdAt,
          updatedAt,
          lastMessage,
          characterId: characterChat?.characterId,
          groupId: groupChat?.groupId,
        } as Chat,
      }
    }),
}
