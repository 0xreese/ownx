'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@cared/ui/lib/utils'

import { Logo } from '@/components/logo'

export function MainNav() {
  const pathname = usePathname()

  return (
    <div className="mr-4 hidden md:flex">
      <Link href="/" className="mr-4 flex items-center gap-2 lg:mr-6">
        <Logo />
      </Link>
      <nav className="flex items-center gap-4 text-sm xl:gap-6">
        <Link
          href="/docs"
          className={cn(
            'transition-colors hover:text-foreground/80',
            pathname === '/docs' ? 'text-foreground' : 'text-foreground/80',
          )}
        >
          Docs
        </Link>
        <Link
          href="/wallet"
          className={cn(
            'transition-colors hover:text-foreground/80',
            pathname.startsWith('/docs/components') && !pathname.startsWith('/docs/component/chart')
              ? 'text-foreground'
              : 'text-foreground/80',
          )}
        >
          Wallet
        </Link>
      </nav>
    </div>
  )
}
