import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@cared/auth'

export const { GET, POST } = toNextJsHandler(auth.handler)
