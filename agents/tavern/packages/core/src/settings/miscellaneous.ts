import { z } from 'zod'

export interface MiscellaneousSettings {
  preferCharacterPrompt: boolean
  preferCharacterJailbreak: boolean

  collapseNewlines: boolean
}

export const miscellaneousSettingsSchema = z.object({
  preferCharacterPrompt: z.boolean(),
  preferCharacterJailbreak: z.boolean(),
  collapseNewlines: z.boolean().optional().default(true),
})

export function fillInMiscellaneousSettingsWithDefaults(settings?: MiscellaneousSettings): MiscellaneousSettings {
  return (
    settings ?? {
      preferCharacterPrompt: true,
      preferCharacterJailbreak: true,
      collapseNewlines: false,
    }
  )
}
