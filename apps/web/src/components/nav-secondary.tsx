'use client'

import type { ComponentPropsWithoutRef } from 'react'
import Link from 'next/link'
import { SiDiscord, SiGithub, SiX } from '@icons-pack/react-simple-icons'
import { GraduationCap } from 'lucide-react'

import { SidebarGroup, SidebarGroupContent, useSidebar } from '@cared/ui/components/sidebar'
import { cn } from '@cared/ui/lib/utils'

import { siteConfig } from '@/config/site'

export function NavSecondary({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { open } = useSidebar()

  return (
    <SidebarGroup className={cn('overflow-hidden', className)} {...props}>
      <SidebarGroupContent>
        <div className="mt-4 flex items-center justify-center gap-4">
          {open && (
            <>
              <Link
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <GraduationCap size={24} />
                <span className="sr-only">Docs</span>
              </Link>
              <Link
                href={siteConfig.links.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <SiX size={20} />
                <span className="sr-only">X (Twitter)</span>
              </Link>
              <Link
                href={siteConfig.links.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <SiDiscord size={20} />
                <span className="sr-only">Discord</span>
              </Link>
              <Link
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <SiGithub size={20} />
                <span className="sr-only">GitHub</span>
              </Link>
            </>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
