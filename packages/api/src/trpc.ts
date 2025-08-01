import type { OpenApiMeta } from 'trpc-to-openapi'
import { connection } from 'next/server'
import * as trpc from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod/v4'

import type { DB } from '@cared/db/client'
import { db } from '@cared/db/client'

import type { Auth } from './auth'
import { authWithHeaders } from './auth'

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async ({
  headers,
  resHeaders,
}: {
  headers: Headers
  resHeaders?: Headers
}): Promise<{
  auth: Partial<Auth>
  db: DB
  headers: Headers
  resHeaders?: Headers
}> => {
  const auth = await authWithHeaders(headers)

  console.log(
    '>>> tRPC Request from',
    headers.get('x-trpc-source') ?? 'unknown',
    'by',
    auth.userId && auth.appId ? `${auth.appId}:${auth.userId}` : (auth.userId ?? auth.appId),
  )

  return {
    auth,
    db,
    headers,
    resHeaders,
  }
}

export type Context = trpc.inferAsyncReturnType<typeof createTRPCContext>

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = trpc.initTRPC
  .meta<OpenApiMeta>()
  .context<Context>()
  .create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }),
  })

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = performance.now()

  if (t._config.isDev) {
    await connection()
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  const result = await next()

  const end = performance.now()
  console.log(`[TRPC] ${path} took ${Math.floor(end - start)}ms to execute`)

  return result
})

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user auth data if they are logged in
 */
export const publicProcedure = t.procedure.use(timingMiddleware)

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to authenticated users, use this.
 * It verifies the auth is valid.
 *
 * @see https://trpc.io/docs/procedures
 */
export const userProtectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new trpc.TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      auth: {
        userId: ctx.auth.userId,
      },
    },
  })
})

export const appProtectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
  if (!ctx.auth.appId) {
    throw new trpc.TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      auth: {
        appId: ctx.auth.appId,
      },
    },
  })
})

export const appUserProtectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
  if (!ctx.auth.appId || !ctx.auth.userId) {
    throw new trpc.TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      auth: {
        appId: ctx.auth.appId,
        userId: ctx.auth.userId,
      },
    },
  })
})

export const appOrUserProtectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.auth.appId && !ctx.auth.userId) {
      throw new trpc.TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
      ctx: {
        auth: {
          appId: ctx.auth.appId,
          userId: ctx.auth.userId,
        },
      },
    })
  })

export const adminProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new trpc.TRPCError({ code: 'UNAUTHORIZED' })
  }
  if (!ctx.auth.isAdmin) {
    throw new trpc.TRPCError({ code: 'FORBIDDEN' })
  }
  return next({
    ctx: {
      auth: {
        userId: ctx.auth.userId,
      },
    },
  })
})
