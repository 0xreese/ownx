import type { Chat } from '@cared/sdk'

import type { CharacterCardV3 } from './character'
import type { CharGroupMetadata } from './character-group'
import type { LorebookEntry } from './lorebook'
import type { Message } from './message'
import type { PersonaMetadata } from './persona'

export type ReducedChat = Pick<Chat, 'id' | 'metadata' | 'createdAt'>

export type ReducedMessage = Pick<Message, 'id' | 'role' | 'content' | 'createdAt'>

export interface ReducedPersona {
  id: string
  name: string
  metadata: PersonaMetadata
}

export interface ReducedCharacter {
  id: string
  content: CharacterCardV3
}

export interface ReducedGroup {
  id: string
  characters: ReducedCharacter[]
  metadata: CharGroupMetadata
}

export interface ReducedLorebook {
  id: string
  name: string
  description?: string | null
  entries: LorebookEntry[]
  chatIds: string[]
  characterIds: string[]
  groupIds: string[]
  personaIds: string[]
  primaryCharacterIds: string[]
}
