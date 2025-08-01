'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@cared/ui/lib/utils'

import { Chat } from '@/app/_page/chat'
import { backgroundFittings } from '@/app/_panels/background-image'
import { useCheckFirstChat } from '@/hooks/use-chat'
import { useCheckLorebooks } from '@/hooks/use-lorebook'
// import { useCheckFirstMessage } from '@/hooks/use-first-message'
import { useBackgroundSettings } from '@/hooks/use-settings'
import { signIn } from '@/lib/sign-in'
import { useTRPC } from '@/trpc/client'
import { Navbar } from './navbar'
import { WelcomeDialog } from './welcome-dialog'

export function PageContent() {
  const trpc = useTRPC()
  const { data: session } = useQuery(trpc.user.session.queryOptions())
  if (!session?.user) {
    void signIn()
  }

  const backgroundSettings = useBackgroundSettings()

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const image = new Image()
    image.src = `${backgroundSettings.active.url}`

    image.onload = () => {
      if (ref.current) {
        ref.current.style.backgroundImage = `url("${backgroundSettings.active.url}")`
      }
    }

    return () => {
      image.src = ''
    }
  }, [backgroundSettings.active.url])

  useCheckFirstChat()
  // useCheckFirstMessage()
  useCheckLorebooks()

  return (
    <div
      ref={ref}
      className={cn(
        'h-screen w-full flex justify-center bg-no-repeat transition-[background-image] duration-500',
        backgroundFittings[backgroundSettings.fitting],
      )}
    >
      <div className="w-full lg:w-1/2 h-full flex flex-col relative">
        <Navbar />
        <Chat />
      </div>

      <WelcomeDialog />
    </div>
  )
}
