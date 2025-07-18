import { useCallback, useEffect, useRef, useState } from 'react'

export function useGeneratingTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const startTimer = useCallback(() => {
    // Clear existing timer if running
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Reset and start new timer
    startTimeRef.current = Date.now()
    setElapsedSeconds(0)

    // Update timer every 0.1 seconds (100ms)
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setElapsedSeconds(Math.round(elapsed * 10) / 10) // Round to 0.1 precision
      }
    }, 100)
  }, [])

  const stopTimer = useCallback((): number => {
    let finalElapsed = 0

    if (startTimeRef.current) {
      finalElapsed = (Date.now() - startTimeRef.current) / 1000
      finalElapsed = Math.round(finalElapsed * 10) / 10 // Round to 0.1 precision
    }

    // Clear timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    startTimeRef.current = null

    setElapsedSeconds(finalElapsed)

    return finalElapsed
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  return { startTimer, stopTimer, elapsedSeconds }
}
