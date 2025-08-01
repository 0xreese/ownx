import type { BetterAuthOptions, LiteralUnion, Models } from 'better-auth'
import { headers } from 'next/headers'
import { db } from '@tavern/db/client'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { customSession, genericOAuth, openAPI } from 'better-auth/plugins'
import { decodeJwt } from 'jose'

import { getKV } from '@cared/kv'
import { generateId } from '@cared/sdk'

import { getBaseUrl } from './client'
import { env } from './env'

const kv = getKV('tavern::auth', 'upstash')

const options = {
  appName: 'CryptoTavern',
  baseURL: getBaseUrl(),
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 12, // 12 hours
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  secondaryStorage: kv,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    storage: 'secondary-storage',
  },
  advanced: {
    // better-auth will use secure cookies in production (https site) by default
    // https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies#secure
    useSecureCookies: undefined,
    // Allow adding domain to the cookie
    // https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies#domain
    crossSubDomainCookies: {
      enabled: true,
    },
    cookiePrefix: 'tavern',
    generateId: ({ model }: { model: LiteralUnion<Models, string> }) =>
      generateId(modelPrefix(model)),
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'cared',
          clientId: env.CARED_CLIENT_ID,
          clientSecret: env.CARED_CLIENT_SECRET,
          discoveryUrl: env.CARED_DISCOVERY_URL,
          pkce: true,
          accessType: 'offline',
          scopes: ['openid', 'email', 'profile', 'offline_access'],
          prompt: 'consent',
          // @ts-ignore
          getUserInfo: (tokens) => {
            if (tokens.idToken) {
              const decoded = decodeJwt(tokens.idToken) as {
                sub: string
                email_verified: boolean
                email: string
                name: string
                profile: string
              }
              if (decoded.sub && decoded.email) {
                return {
                  id: decoded.sub,
                  emailVerified: decoded.email_verified,
                  image: decoded.profile,
                  ...decoded,
                }
              }
            }
            return null
          },
        },
      ],
    }),
    openAPI(),
    // Make sure this is the last plugin in the array
    // https://www.better-auth.com/docs/integrations/next#server-action-cookies
    nextCookies(),
  ],
  onAPIError: {
    errorURL: '/auth/error',
  },
} satisfies BetterAuthOptions

export const auth = betterAuth({
  ...options,
  plugins: [
    ...options.plugins,
    // eslint-disable-next-line @typescript-eslint/require-await
    customSession(async ({ user, session }) => {
      // now both user and session will infer the fields added by plugins and your custom fields
      return {
        user,
        session,
      }
    }, options), // pass options here
  ],
})

Object.entries(auth.api).forEach(([key, _endpoint]) => {
  const endpoint = async (args: any) => {
    // @ts-ignore
    return _endpoint({
      ...args,
      headers: await headers(),
    })
  }
  Object.entries(_endpoint).forEach(([k, v]) => {
    // @ts-ignore
    endpoint[k] = v
  })
  // @ts-ignore
  auth.api[key] = endpoint
})

function modelPrefix(model: LiteralUnion<Models, string>) {
  switch (model) {
    case 'user':
      return 'user'
    case 'account':
      return 'acc'
    case 'session':
      return 'ses'
    case 'verification':
      return 'vrf'
    case 'rate-limit':
      return 'rl'
    default:
      return model.slice(0, 6)
  }
}
