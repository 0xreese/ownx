import type { Chat, Message } from '@ownxai/sdk'

import type { CharacterCardV2 } from './character'
import type { CharGroupMetadata } from './character-group'
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
  content: CharacterCardV2
}

export interface ReducedGroup {
  id: string
  characters: ReducedCharacter[]
  metadata: CharGroupMetadata
}
