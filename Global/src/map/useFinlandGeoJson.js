import { useEffect, useState } from 'react'

export function useFinlandGeoJson(url) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (alive) setData(json)
      })
      .catch(() => {
        if (alive) setData(null)
      })
    return () => {
      alive = false
    }
  }, [url])

  return data
}
