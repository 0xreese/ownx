'use client'

import { useEffect, useRef, useState } from 'react'
import {
  faArrowRotateLeft,
  faBinoculars,
  faFileCirclePlus,
  faFileExport,
  faFileImport,
  faLock,
  faSave,
  faTrashCan,
  faUnlock,
} from '@fortawesome/free-solid-svg-icons'

import { Button } from '@cared/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cared/ui/components/dialog'
import { Input } from '@cared/ui/components/input'
import { Label } from '@cared/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cared/ui/components/select'
import { cn } from '@cared/ui/lib/utils'

import { FaButton } from '@/components/fa-button'
import { JsonDisplay } from '@/components/json-display'
import { CircleSpinner } from '@/components/spinner'
import {
  useActiveModelPreset,
  useCreateModelPreset,
  useCustomizeModelPreset,
  useDeleteModelPreset,
  useModelPresets,
} from '@/hooks/use-model-preset'
import { useAppearanceSettings, useUpdateSettingsMutation } from '@/hooks/use-settings'
import { ImportPresetDialog } from './import-preset-dialog'
import { ModelConf } from './model-conf'
import { PromptEdit } from './prompt-edit'
import { PromptInspect } from './prompt-inspect'
import { PromptList } from './prompt-list'

export function ModelConfigurationPanel() {
  const appearanceSettings = useAppearanceSettings()
  const updateSettings = useUpdateSettingsMutation()
  const { modelPresets: presets } = useModelPresets()
  const { activePreset, setActivePreset } = useActiveModelPreset()
  const createModelPreset = useCreateModelPreset()
  const deleteModelPreset = useDeleteModelPreset()

  const { customization, updateModelPresetWithCustomization, restoreModelPreset } =
    useCustomizeModelPreset()

  const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewChangesDialogOpen, setIsViewChangesDialogOpen] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const handleSaveAs = async (name: string) => {
    await createModelPreset(name, activePreset.preset)
    await setActivePreset(name)
  }

  const handleDelete = async () => {
    await deleteModelPreset(activePreset.id)
  }

  const operateActions = [
    {
      action: updateModelPresetWithCustomization,
      icon: faSave,
      tooltip: 'Update preset',
      disabled: !customization,
      className: customization
        ? 'text-green-500 hover:text-green-500 hover:bg-muted'
        : 'disabled:pointer-events-none disabled:opacity-50',
    },
    {
      action: restoreModelPreset,
      icon: faArrowRotateLeft,
      tooltip: 'Restore preset',
      disabled: !customization,
      className: customization
        ? 'text-destructive-foreground hover:text-destructive-foreground hover:bg-destructive'
        : 'disabled:pointer-events-none disabled:opacity-50',
    },
    {
      action: () => setIsViewChangesDialogOpen(true),
      icon: faBinoculars,
      tooltip: 'View preset changes',
      disabled: !customization,
      className: !customization ? 'disabled:pointer-events-none disabled:opacity-50' : '',
    },
    {
      action: () => setIsSaveAsDialogOpen(true),
      icon: faFileCirclePlus,
      tooltip: 'Save preset as...',
    },
    {
      action: () => importFileInputRef.current?.click(),
      icon: faFileImport,
      tooltip: 'Import preset',
    },
    {
      action: () => setIsExportDialogOpen(true),
      icon: faFileExport,
      tooltip: 'Export preset',
    },
    {
      action: () => setIsDeleteDialogOpen(true),
      icon: faTrashCan,
      tooltip: 'Delete preset',
      disabled: presets.length <= 1,
      className: presets.length <= 1 ? 'disabled:pointer-events-none disabled:opacity-50' : '',
    },
  ]

  return (
    <div className="flex flex-col gap-2 px-2 py-1.5">
      <div className="flex flex-row items-center justify-between gap-4 m-[1px]">
        <FaButton
          icon={appearanceSettings.modelPresetPanelLocked ? faLock : faUnlock}
          btnSize="size-6"
          iconSize="xl"
          title="If locked, character management panel will stay open"
          onClick={async () => {
            await updateSettings({
              appearance: {
                ...appearanceSettings,
                modelPresetPanelLocked: !appearanceSettings.modelPresetPanelLocked,
              },
            })
          }}
        />

        <Label>LLM Preset</Label>

        <Select value={activePreset.name} onValueChange={setActivePreset}>
          <SelectTrigger className="flex-1 h-7 px-2 py-0.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-6000">
            {presets.map((preset) => (
              <SelectItem key={preset.name} value={preset.name} className="py-0.5">
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end items-center gap-1">
        {operateActions.map(({ action, icon, tooltip, disabled, className }, index) => (
          <FaButton
            key={index}
            icon={icon}
            btnSize="size-6"
            iconSize="1x"
            title={tooltip}
            className={cn(
              'text-foreground border-1 border-border hover:bg-muted-foreground rounded-sm',
              className,
            )}
            disabled={disabled}
            onClick={action}
          />
        ))}
      </div>

      <div className="space-y-4">
        <ModelConf />
        <PromptList />
      </div>

      <PromptInspect />
      <PromptEdit />

      <SaveAsDialog
        open={isSaveAsDialogOpen}
        onOpenChange={setIsSaveAsDialogOpen}
        activePresetName={activePreset.name}
        onSave={handleSaveAs}
      />

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        preset={activePreset}
      />

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        presetName={activePreset.name}
        onDelete={handleDelete}
      />

      <ViewChangesDialog
        open={isViewChangesDialogOpen}
        onOpenChange={setIsViewChangesDialogOpen}
        customization={customization}
      />

      <ImportPresetDialog
        ref={importFileInputRef}
        onImport={setActivePreset}
        existingPresets={presets}
      />
    </div>
  )
}

function SaveAsDialog({
  open,
  onOpenChange,
  activePresetName,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activePresetName: string
  onSave: (name: string) => Promise<void>
}) {
  const [newPresetName, setNewPresetName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { modelPresets } = useModelPresets()

  useEffect(() => {
    setNewPresetName(open ? activePresetName : '')
  }, [open, activePresetName])

  const handleSave = async () => {
    if (!newPresetName.trim()) return

    setIsSaving(true)
    try {
      await onSave(newPresetName.trim())
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  // Check if the name already exists in presets
  const isNameDuplicate = modelPresets.some((preset) => preset.name === newPresetName.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Preset As</DialogTitle>
          <DialogDescription>
            Enter a name for the new preset. Hint: Use a character/group name to bind preset to a
            specific chat.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          placeholder="Enter preset name"
          autoFocus
          disabled={isSaving}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!newPresetName.trim() || isNameDuplicate || isSaving}
          >
            {isSaving ? (
              <>
                <CircleSpinner />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExportDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset: { name: string; preset: any }
}) {
  const handleExport = () => {
    // Create a blob with the preset data
    const blob = new Blob([JSON.stringify(preset.preset, null, 2)], {
      type: 'application/json',
    })

    // Create a download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${preset.name}.json`

    // Trigger download
    document.body.appendChild(link)
    link.click()

    // Cleanup
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // Close dialog
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Preset</DialogTitle>
          <DialogDescription>
            Are you sure you want to export the preset "{preset.name}"? This will download a JSON
            file containing the preset configuration.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  open,
  onOpenChange,
  presetName,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetName: string
  onDelete: () => Promise<void>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Preset</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the preset "{presetName}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <CircleSpinner />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ViewChangesDialog({
  open,
  onOpenChange,
  customization,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customization: any
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>View Preset Changes</DialogTitle>
          <DialogDescription>
            Below shows the changes made to the original preset.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[50dvh]">
          <JsonDisplay data={customization || {}} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
