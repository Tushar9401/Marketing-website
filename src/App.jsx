import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const DB_NAME = 'ad-slideshow-cache'
const STORE_NAME = 'media'
const DB_VERSION = 1
const IMAGE_DURATION = 4000
const SLIDE_TRANSITION_DURATION = 650

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withMediaStore(mode, callback) {
  const db = await openMediaDb()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const result = callback(store)

    transaction.oncomplete = () => {
      db.close()
      resolve(result)
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

function getAllMedia() {
  return withMediaStore('readonly', (store) => {
    const request = store.getAll()
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result.sort((a, b) => a.createdAt - b.createdAt))
      }
      request.onerror = () => reject(request.error)
    })
  })
}

function addMedia(item) {
  return withMediaStore('readwrite', (store) => store.put(item))
}

function deleteMedia(id) {
  return withMediaStore('readwrite', (store) => store.delete(id))
}

function clearMedia() {
  return withMediaStore('readwrite', (store) => store.clear())
}

function useObjectUrls(items) {
  const urls = useMemo(() => {
    const nextUrls = {}
    items.forEach((item) => {
      nextUrls[item.id] = URL.createObjectURL(item.blob)
    })
    return nextUrls
  }, [items])

  useEffect(() => {
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [urls])

  return urls
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** index
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function Dashboard() {
  const inputRef = useRef(null)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const urls = useObjectUrls(items)
  const hasItems = items.length > 0

  async function refresh() {
    setItems(await getAllMedia())
    setIsLoading(false)
  }

  useEffect(() => {
    let isActive = true

    queueMicrotask(async () => {
      try {
        const media = await getAllMedia()
        if (isActive) {
          setItems(media)
          setIsLoading(false)
        }
      } catch {
        if (isActive) {
          setMessage('Could not read the browser cache.')
          setIsLoading(false)
        }
      }
    })

    return () => {
      isActive = false
    }
  }, [])

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    setMessage('Adding media...')
    const mediaFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))

    await Promise.all(
      mediaFiles.map((file, index) =>
        addMedia({
          id: `${Date.now()}-${index}-${crypto.randomUUID()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          blob: file,
          createdAt: Date.now() + index,
        }),
      ),
    )

    event.target.value = ''
    await refresh()
    setMessage(
      mediaFiles.length === files.length
        ? `${mediaFiles.length} item${mediaFiles.length === 1 ? '' : 's'} added.`
        : 'Only image and video files were added.',
    )
  }

  async function handleRemove(id) {
    await deleteMedia(id)
    await refresh()
    setMessage('Media removed.')
  }

  async function handleClear() {
    await clearMedia()
    await refresh()
    setMessage('Cache cleared.')
  }

  function openShowTab() {
    window.open('/show', '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Client-side ad playlist</p>
            <h1>Marketing Builder</h1>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
              Add media
            </button>
            <button type="button" className="primary-button" onClick={openShowTab} disabled={!hasItems}>
              Show
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          className="file-input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFilesSelected}
        />

        <div className="drop-zone" onClick={() => inputRef.current?.click()} role="button" tabIndex="0">
          <div>
            <strong>Attach images and videos</strong>
            <span>Files are cached in this browser only until the backend is added.</span>
          </div>
        </div>

        <div className="section-header">
          <div>
            <h2>Current media</h2>
            <p>{isLoading ? 'Loading cache...' : `${items.length} item${items.length === 1 ? '' : 's'} ready`}</p>
          </div>
          <button type="button" className="text-button" onClick={handleClear} disabled={!hasItems}>
            Remove all
          </button>
        </div>

        {message && <p className="status">{message}</p>}

        {hasItems ? (
          <div className="media-grid">
            {items.map((item, index) => (
              <article className="media-card" key={item.id}>
                <div className="preview-frame">
                  {item.type.startsWith('video/') ? (
                    <video src={urls[item.id]} muted playsInline />
                  ) : (
                    <img src={urls[item.id]} alt={item.name} />
                  )}
                  <span className="order-badge">{index + 1}</span>
                </div>
                <div className="media-meta">
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {item.type.startsWith('video/') ? 'Video' : 'Image'} · {formatBytes(item.size)}
                    </p>
                  </div>
                  <button type="button" className="remove-button" onClick={() => handleRemove(item.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No media added yet</h2>
            <p>Add images or videos, then use Show to launch the fullscreen slideshow tab.</p>
          </div>
        )}
      </section>
    </main>
  )
}

function Slideshow() {
  const videoRef = useRef(null)
  const transitionTimeoutRef = useRef(null)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isChanging, setIsChanging] = useState(false)
  const urls = useObjectUrls(items)
  const activeItem = items[activeIndex]

  useEffect(() => {
    getAllMedia()
      .then((media) => {
        setItems(media)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  const nextSlide = useCallback(() => {
    if (items.length < 2 || isChanging) return

    setIsChanging(true)
    window.clearTimeout(transitionTimeoutRef.current)
    transitionTimeoutRef.current = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % items.length)
      setIsChanging(false)
    }, SLIDE_TRANSITION_DURATION)
  }, [isChanging, items.length])

  useEffect(() => {
    return () => window.clearTimeout(transitionTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!activeItem || activeItem.type.startsWith('video/') || isChanging) return undefined
    const timer = window.setTimeout(nextSlide, IMAGE_DURATION)
    return () => window.clearTimeout(timer)
  }, [activeItem, isChanging, nextSlide])

  useEffect(() => {
    if (!activeItem?.type.startsWith('video/') || !videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play().catch(() => undefined)
  }, [activeItem])

  if (isLoading) {
    return <main className="slideshow-screen"><p>Loading slideshow...</p></main>
  }

  if (!items.length) {
    return (
      <main className="slideshow-screen empty-show">
        <h1>No media in cache</h1>
        <button type="button" onClick={() => window.close()}>
          Close
        </button>
      </main>
    )
  }

  return (
    <main className="slideshow-screen">
      <div className="slide-stage">
        {activeItem.type.startsWith('video/') ? (
          <video
            ref={videoRef}
            key={activeItem.id}
            src={urls[activeItem.id]}
            className={`slide-media ${isChanging ? 'is-exiting' : ''}`}
            autoPlay
            muted
            playsInline
            onEnded={nextSlide}
          />
        ) : (
          <img
            key={activeItem.id}
            src={urls[activeItem.id]}
            className={`slide-media ${isChanging ? 'is-exiting' : ''}`}
            alt={activeItem.name}
          />
        )}
      </div>
      <div className="slide-counter">
        {activeIndex + 1} / {items.length}
      </div>
    </main>
  )
}

export default function App() {
  return window.location.pathname === '/show' ? <Slideshow /> : <Dashboard />
}
