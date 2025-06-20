import { z } from 'zod'

import type { AppearanceSettings } from './appearance'
import type { BackgroundSettings } from './background'
import type { CharacterSettings } from './character'
import type { LorebookSettings } from './lorebook'
import type { ModelSettings } from './model'
import type { ModelPresetSettings } from './model-preset'
import type { PersonaSettings } from './persona'
import type { TagsSettings } from './tags'
import { appearanceSettingsSchema, fillInAppearanceSettingsWithDefaults } from './appearance'
import { backgroundSettingsSchema, fillInBackgroundSettingsWithDefaults } from './background'
import { characterSettingsSchema, fillInCharacterSettingsWithDefaults } from './character'
import { fillInLorebookSettingsWithDefaults, lorebookSettingsSchema } from './lorebook'
import { fillInModelSettingsWithDefaults, modelSettingsSchema } from './model'
import { fillInModelPresetSettingsWithDefaults, modelPresetSettingsSchema } from './model-preset'
import { fillInPersonaSettingsWithDefaults, personaSettingsSchema } from './persona'
import { fillInTagsSettingsWithDefaults, tagsSettingsSchema } from './tags'

export * from './background'
export * from './theme'
export * from './model-preset'
export * from './tags'
export * from './model'
export * from './lorebook'
export * from './character'
export * from './persona'

export interface Settings {
  firstRun: boolean
  background: BackgroundSettings
  appearance: AppearanceSettings
  tags: TagsSettings
  modelPreset: ModelPresetSettings
  model: ModelSettings
  lorebook: LorebookSettings
  character: CharacterSettings
  persona: PersonaSettings
}

export const settingsSchema = z.object({
  firstRun: z.boolean(),
  background: backgroundSettingsSchema,
  appearance: appearanceSettingsSchema,
  tags: tagsSettingsSchema,
  modelPreset: modelPresetSettingsSchema,
  model: modelSettingsSchema,
  lorebook: lorebookSettingsSchema,
  character: characterSettingsSchema,
  persona: personaSettingsSchema,
})

export function fillInSettingsWithDefaults(settings: Partial<Settings>): Settings {
  return {
    firstRun: settings.firstRun ?? true,
    background: fillInBackgroundSettingsWithDefaults(settings.background),
    appearance: fillInAppearanceSettingsWithDefaults(settings.appearance),
    tags: fillInTagsSettingsWithDefaults(settings.tags),
    modelPreset: fillInModelPresetSettingsWithDefaults(settings.modelPreset),
    model: fillInModelSettingsWithDefaults(settings.model),
    lorebook: fillInLorebookSettingsWithDefaults(settings.lorebook),
    character: fillInCharacterSettingsWithDefaults(settings.character),
    persona: fillInPersonaSettingsWithDefaults(settings.persona),
  }
}
