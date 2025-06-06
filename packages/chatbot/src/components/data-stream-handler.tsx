'use client'

import type { ArtifactKind } from '@/artifacts'
import { useEffect, useRef } from 'react'
import { useChat } from 'ai/react'

import type { ArtifactSuggestion } from '@ownxai/db/schema'

import { artifactDefinitions } from '@/artifacts'
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact'

export interface DataStreamDelta {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
  content: string | ArtifactSuggestion
}

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream } = useChat({ id })
  const { artifact, setArtifact, setMetadata } = useArtifact()
  const lastProcessedIndex = useRef(-1)

  useEffect(() => {
    if (!dataStream?.length) return

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1)
    lastProcessedIndex.current = dataStream.length - 1
    ;(newDeltas as unknown as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      )

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          setMetadata,
        })
      }

      setArtifact((draftArtifact) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!draftArtifact) {
          return { ...initialArtifactData, status: 'streaming' }
        }

        switch (delta.type) {
          case 'id':
            return {
              ...draftArtifact,
              documentId: delta.content as string,
              status: 'streaming',
            }

          case 'title':
            return {
              ...draftArtifact,
              title: delta.content as string,
              status: 'streaming',
            }

          case 'kind':
            return {
              ...draftArtifact,
              kind: delta.content as ArtifactKind,
              status: 'streaming',
            }

          case 'clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            }

          case 'finish':
            return {
              ...draftArtifact,
              status: 'idle',
            }

          default:
            return draftArtifact
        }
      })
    })
  }, [dataStream, setArtifact, setMetadata, artifact])

  return null
}
