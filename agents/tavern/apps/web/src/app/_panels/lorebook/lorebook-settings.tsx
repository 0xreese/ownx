import type { z } from 'zod/v4'
import { memo, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { lorebookSettingsSchema } from '@tavern/core'
import { ChevronDownIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { Button } from '@cared/ui/components/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@cared/ui/components/collapsible'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@cared/ui/components/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cared/ui/components/select'

import { CheckboxField } from '@/components/checkbox-field'
import { SliderInputField } from '@/components/slider-input-field'
import { useLorebookSettings, useUpdateLorebookSettings } from '@/hooks/use-settings'

const formSchema = lorebookSettingsSchema.omit({
  active: true,
})

type FormValues = z.infer<typeof formSchema>

export const LorebookSettings = memo(function LorebookSettings({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const lorebookSettings = useLorebookSettings()
  const updateLorebookSettings = useUpdateLorebookSettings()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: lorebookSettings,
  })

  useEffect(() => {
    form.reset(lorebookSettings)
  }, [lorebookSettings, form])

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <div className="flex justify-between items-center cursor-pointer [&[data-state=open]>button>svg]:rotate-180">
          <span className="text-sm">Global settings for lorebooks activation</span>
          <Button type="button" variant="outline" size="icon" className="size-6">
            <ChevronDownIcon className="transition-transform duration-200" />
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden mt-2">
        <Form {...form}>
          <form
            onBlur={() => {
              void updateLorebookSettings(form.getValues())
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-8"
          >
            <div className="flex flex-col gap-2">
              <SliderInputField
                label="Scan Depth"
                name="scanDepth"
                control={form.control}
                min={0}
                max={100}
                step={1}
              />

              <SliderInputField
                label="Context %"
                name="context"
                control={form.control}
                min={1}
                max={100}
                step={1}
              />

              <SliderInputField
                label="Budget Cap"
                name="budgetCap"
                control={form.control}
                min={0}
                max={8192}
                step={1}
              />

              <SliderInputField
                label="Min Activations"
                name="minActivations"
                control={form.control}
                min={0}
                max={100}
                step={1}
              />

              <SliderInputField
                label="Max Depth"
                name="maxDepth"
                control={form.control}
                min={0}
                max={100}
                step={1}
              />

              <SliderInputField
                label="Max Recursion Steps"
                name="maxRecursionSteps"
                control={form.control}
                min={0}
                max={10}
                step={1}
              />
            </div>

            <div className="flex flex-col gap-2">
              <FormField
                control={form.control}
                name="insertionStrategy"
                render={({ field }) => (
                  <FormItem className="my-4 md:mt-0">
                    <FormLabel>Insertion Strategy</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-7 px-2 py-0.5">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-6000">
                        <SelectItem value="evenly">Sorted Evenly</SelectItem>
                        <SelectItem value="character_first">Character Lore First</SelectItem>
                        <SelectItem value="global_first">Global Lore First</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Controls how lorebook entries are inserted into the context
                    </FormDescription>
                  </FormItem>
                )}
              />

              <CheckboxField
                label="Include Names"
                name="includeNames"
                control={form.control}
                description="Include character names in the matching process"
              />

              <CheckboxField
                label="Recursive Scan"
                name="recursiveScan"
                control={form.control}
                description="Enable recursive scanning of lorebook entries"
              />

              <CheckboxField
                label="Case Sensitive"
                name="caseSensitive"
                control={form.control}
                description="Make matching case sensitive"
              />

              <CheckboxField
                label="Match Whole Words"
                name="matchWholeWords"
                control={form.control}
                description="Only match complete words"
              />

              <CheckboxField
                label="Use Group Scoring"
                name="useGroupScoring"
                control={form.control}
                description="Enable group-based scoring for entries"
              />

              <CheckboxField
                label="Alert on Overflow"
                name="alertOnOverflow"
                control={form.control}
                description="Show alert when context budget is exceeded"
              />
            </div>
          </form>
        </Form>
      </CollapsibleContent>
    </Collapsible>
  )
})
