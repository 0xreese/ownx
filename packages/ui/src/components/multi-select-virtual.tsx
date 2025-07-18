import * as React from 'react'
import { useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDown, WandSparkles, XCircle, XIcon } from 'lucide-react'
import { Virtualizer } from 'virtua'

import type { MultiSelectProps } from './multi-select'
import { cn } from '../lib/utils'
import { Badge } from './badge'
import { Button } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './command'
import { multiSelectVariants } from './multi-select'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Separator } from './separator'

export const MultiSelectVirtual = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      disabled,
      options,
      values,
      onValuesChange,
      variant,
      placeholder = 'Select options',
      animation = 0,
      maxCount = 3,
      modalPopover = false,
      className,
      contentClassName,
      ...props
    },
    ref,
  ) => {
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
    const [isAnimating, setIsAnimating] = React.useState(false)

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        setIsPopoverOpen(true)
      } else if (event.key === 'Backspace' && !event.currentTarget.value) {
        const newSelectedValues = [...values]
        newSelectedValues.pop()
        onValuesChange(newSelectedValues)
      }
    }

    const toggleOption = (option: string) => {
      const newSelectedValues = values.includes(option)
        ? values.filter((value) => value !== option)
        : [...values, option]
      onValuesChange(newSelectedValues)
    }

    const handleClear = () => {
      onValuesChange([])
    }

    const handleTogglePopover = () => {
      setIsPopoverOpen((prev) => !prev)
    }

    const clearExtraOptions = () => {
      const newSelectedValues = values.slice(0, maxCount)
      onValuesChange(newSelectedValues)
    }

    const toggleAll = () => {
      if (values.length === options.length) {
        handleClear()
      } else {
        const allValues = options.map((option) => option.value)
        onValuesChange(allValues)
      }
    }

    const scrollRef = useRef<HTMLDivElement>(null)

    const [searchValue, setSearchValue] = useState('')
    const filteredOptions = useMemo(() => {
      if (!searchValue.trim()) return options
      return options.filter((t) => t.label.toLowerCase().includes(searchValue.trim().toLowerCase()))
    }, [options, searchValue])

    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} modal={modalPopover}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            {...props}
            disabled={disabled}
            onClick={handleTogglePopover}
            className={cn(
              'flex w-full p-1 rounded-md border min-h-10 h-auto items-center justify-between bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto',
              className,
            )}
          >
            {values.length > 0 ? (
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-wrap items-center">
                  {values.slice(0, maxCount).map((value) => {
                    const option = options.find((o) => o.value === value)
                    const IconComponent = option?.icon
                    return (
                      <Badge
                        key={value}
                        className={cn(
                          isAnimating ? 'animate-bounce' : '',
                          multiSelectVariants({ variant }),
                        )}
                        style={{ animationDuration: `${animation}s` }}
                      >
                        {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
                        {option?.label}
                        <span>
                          <XCircle
                            className="ml-2 h-4 w-4 cursor-pointer"
                            onClick={(event) => {
                              console.log('xcircle', event)
                              event.stopPropagation()
                              toggleOption(value)
                            }}
                          />
                        </span>
                      </Badge>
                    )
                  })}
                  {values.length > maxCount && (
                    <Badge
                      className={cn(
                        'bg-transparent text-foreground border-foreground/1 hover:bg-transparent',
                        isAnimating ? 'animate-bounce' : '',
                        multiSelectVariants({ variant }),
                      )}
                      style={{ animationDuration: `${animation}s` }}
                    >
                      {`+ ${values.length - maxCount} more`}
                      <span>
                        <XCircle
                          className="ml-2 h-4 w-4 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation()
                            clearExtraOptions()
                          }}
                        />
                      </span>
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <XIcon
                    className="h-4 mx-2 cursor-pointer text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleClear()
                    }}
                  />
                  <Separator orientation="vertical" className="flex min-h-6 h-full" />
                  <ChevronDown className="h-4 mx-2 cursor-pointer text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full mx-auto">
                <span className="text-sm text-muted-foreground mx-3 truncate">{placeholder}</span>
                <ChevronDown className="h-4 cursor-pointer text-muted-foreground mx-2" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn('w-auto p-0', contentClassName)}
          align="start"
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={searchValue}
              onValueChange={setSearchValue}
              onKeyDown={handleInputKeyDown}
            />
            <CommandList ref={scrollRef}>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                <Virtualizer scrollRef={scrollRef}>
                  {filteredOptions === options && (
                    <CommandItem key="all" onSelect={toggleAll} className="cursor-pointer">
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          values.length === options.length
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible',
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </div>
                      <span>(Select All)</span>
                    </CommandItem>
                  )}
                  {filteredOptions.map((option) => {
                    const isSelected = values.includes(option.value)
                    return (
                      <CommandItem
                        key={option.value}
                        onSelect={() => toggleOption(option.value)}
                        className="cursor-pointer"
                      >
                        <div
                          className={cn(
                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'opacity-50 [&_svg]:invisible',
                          )}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </div>
                        {option.icon && (
                          <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{option.label}</span>
                      </CommandItem>
                    )
                  })}
                </Virtualizer>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center justify-between">
                  {values.length > 0 && (
                    <>
                      <CommandItem
                        onSelect={handleClear}
                        className="flex-1 justify-center cursor-pointer"
                      >
                        Clear
                      </CommandItem>
                      <Separator orientation="vertical" className="flex min-h-6 h-full" />
                    </>
                  )}
                  <CommandItem
                    onSelect={() => setIsPopoverOpen(false)}
                    className="flex-1 justify-center cursor-pointer max-w-full"
                  >
                    Close
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
        {animation > 0 && values.length > 0 && (
          <WandSparkles
            className={cn(
              'cursor-pointer my-2 text-foreground bg-background w-3 h-3',
              isAnimating ? '' : 'text-muted-foreground',
            )}
            onClick={() => setIsAnimating(!isAnimating)}
          />
        )}
      </Popover>
    )
  },
)

MultiSelectVirtual.displayName = 'MultiSelectVirtual'
