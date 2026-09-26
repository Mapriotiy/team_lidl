import { useCallback, useEffect, useState } from 'react'
import { getDataSources, type DataSourcesSnapshot } from '../../api/dataSources'
import { errorMessage } from '../../api/errors'

export function useDataSources(limit = 100) {
  const [snapshot, setSnapshot] = useState<DataSourcesSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      setLoading(true)
      try {
        const result = await getDataSources(limit, controller.signal)
        if (!controller.signal.aborted) { setSnapshot(result); setError('') }
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          timer = setTimeout(() => void poll(), 15000)
        }
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [limit, revision])
  return { snapshot, loading, error, refresh }
}
