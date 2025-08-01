import type { EmbeddingModelV2, ImageModelV2, LanguageModelV2 } from '@ai-sdk/provider'

export interface Provider {
  languageModel?(modelId: string): LanguageModelV2

  textEmbeddingModel?(modelId: string): EmbeddingModelV2<string>

  image?(modelId: string): ImageModelV2
}

export const modelTypes = ['language', 'text-embedding', 'image'] as const
export type ModelType = (typeof modelTypes)[number]

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  // | 'azure'
  // | 'bedrock'
  | 'google'
  | 'vertex'
  | 'mistral'
  | 'xai'
  | 'togetherai'
  | 'cohere'
  | 'fireworks'
  | 'deepinfra'
  | 'cerebras'
  | 'groq'
  | 'replicate'
  | 'perplexity'
  | 'luma'
  | 'openrouter'

export interface ProviderInfo {
  id: ProviderId
  name: string
  icon: string
  description: string
  languageModels?: ModelInfo[]
  textEmbeddingModels?: (ModelInfo & { dimensions?: number })[]
  imageModels?: ModelInfo[]
}

export interface ModelInfo {
  id: string
  name: string
  description: string
  maxInputTokens?: number
  maxOutputTokens?: number
  inputTokenPrice?: string // decimal string, in $USD/input token; * 1e6 = $USD/M input tokens
  outputTokenPrice?: string // decimal string, in $USD/input token; * 1e6 = $USD/M input tokens
  dimensions?: number // for embedding models
}
