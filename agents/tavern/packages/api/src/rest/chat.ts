import assert from 'assert'
import type { MessageMetadata } from '@tavern/core'
import { messageContentSchema, modelPresetSchema } from '@tavern/core'
import { db } from '@tavern/db/client'
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai'
import { z } from 'zod/v4'

import { log } from '@cared/log'
import { generateMessageId, modelMessageSchema, toUIMessages } from '@cared/sdk'

import { auth } from '../auth'
import { createCaredClient } from '../cared'

const requestBodySchema = z.object({
  id: z.string(),
  messages: z.array(modelMessageSchema).min(1),
  lastMessage: z.object({
    id: z.string(),
    parentId: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    role: z.enum(['user', 'assistant']),
    content: messageContentSchema,
  }),
  isLastNew: z.boolean().optional(),
  isContinuation: z.boolean().optional(),
  generateType: z.enum(['continue', 'impersonate']).optional(),
  deleteTrailing: z.boolean().optional(),

  characterId: z.string().min(1),
  characterName: z.string().min(1),
  modelId: z.string().min(1),

  preferredLanguage: z.enum(['chinese', 'japanese']).optional(),

  ...modelPresetSchema.pick({
    maxTokens: true,
    temperature: true,
    topP: true,
    topK: true,
    presencePenalty: true,
    frequencyPenalty: true,
    stopSequences: true,
    seed: true,
  }).shape,
})

export async function POST(request: Request): Promise<Response> {
  let requestBody: z.infer<typeof requestBodySchema>

  try {
    const json = await request.json()
    requestBody = requestBodySchema.parse(json)
  } catch (error: any) {
    return new Response(
      `Invalid request: ${error instanceof Error ? error.message : error.toString()}`,
      { status: 400 },
    )
  }

  const {
    id,
    messages,
    lastMessage,
    isLastNew,
    isContinuation,
    deleteTrailing,
    characterId,
    characterName,
    modelId,
    preferredLanguage,

    maxTokens: maxOutputTokens,
    temperature,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    stopSequences,
    seed,
  } = requestBody
  console.log('messages:', JSON.stringify(messages, undefined, 2))

  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const ctx = {
    auth: {
      userId,
    },
    db,
  }

  const cared = createCaredClient(ctx)
  const caredTrpc = cared.trpc

  const languageModel = await cared.createLanguageModel(modelId)

  const chat = (await caredTrpc.chat.byId.query({ id })).chat

  if (deleteTrailing) {
    assert.ok(!isLastNew, 'deleteTrailing should not be used with isLastNew')
    await caredTrpc.message.delete.mutate({
      id: lastMessage.id,
      deleteTrailing: true,
      excludeSelf: true,
    })
  }
  if (isLastNew) {
    await caredTrpc.message.create.mutate({
      chatId: chat.id,
      ...lastMessage,
    })
  }

  const metadata: MessageMetadata = isContinuation
    ? lastMessage.content.metadata
    : {
        characterId,
        characterName,
        modelId,
      }

  const originalMessages =
    isContinuation && lastMessage.role === 'assistant' ? toUIMessages([lastMessage]) : undefined

  const stream = createUIMessageStream({
    execute: ({ writer: dataStream }) => {
      const result = streamText({
        model: languageModel,
        messages,
        stopWhen: stepCountIs(5),
        experimental_transform: smoothStream({
          chunking:
            preferredLanguage === 'chinese'
              ? /[\u4E00-\u9FFF]|\S+\s+/
              : preferredLanguage === 'japanese'
                ? /[\u3040-\u309F\u30A0-\u30FF]|\S+\s+/
                : 'word',
        }),
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'stream-text',
        },

        maxOutputTokens,
        temperature,
        topP,
        topK,
        presencePenalty,
        frequencyPenalty,
        stopSequences,
        seed: seed !== -1 ? seed : undefined,
      })

      void result.consumeStream()

      dataStream.merge(
        result.toUIMessageStream({
          originalMessages, // message persistence
          messageMetadata: () => metadata,
          sendReasoning: true,
          sendSources: true,
          sendStart: true, // message persistence
          sendFinish: true,
        }),
      )
    },
    generateId: generateMessageId,
    originalMessages, // message persistence
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onFinish: async ({ responseMessage, isContinuation }) => {
      assert.equal(responseMessage.role, 'assistant')
      if (isContinuation) {
        assert.equal(responseMessage.id, lastMessage.id)

        await caredTrpc.message.update.mutate({
          id: responseMessage.id,
          content: responseMessage,
        })
      } else {
        await caredTrpc.message.create.mutate({
          id: responseMessage.id,
          parentId: lastMessage.id,
          chatId: chat.id,
          role: responseMessage.role,
          content: responseMessage,
        })
      }
    },
    onError: (error) => {
      log.error('AI SDK streamText error', error)
      return `Internal server error`
    },
  })

  return createUIMessageStreamResponse({ stream })
}
