import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clearCurrentUser, getCurrentUser } from '../authSession.js'
import '../App.css'

const DB_NAME = 'ad-slideshow-cache'
const STORE_NAME = 'media'
const DB_VERSION = 1
const LISTS_STORAGE_KEY = 'ad-slideshow-lists'
const DEFAULT_LIST_ID = 'main-display'
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

function updateMedia(item) {
  return withMediaStore('readwrite', (store) => store.put(item))
}

function deleteMedia(id) {
  return withMediaStore('readwrite', (store) => store.delete(id))
}

function getStoredLists() {
  try {
    const lists = JSON.parse(localStorage.getItem(LISTS_STORAGE_KEY) ?? '[]')
    if (Array.isArray(lists) && lists.length) return lists
  } catch {
    localStorage.removeItem(LISTS_STORAGE_KEY)
  }

  return [{ id: DEFAULT_LIST_ID, name: 'Main Display', createdAt: Date.now() }]
}

function saveStoredLists(lists) {
  localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists))
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

export default function Home() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [currentUser] = useState(() => getCurrentUser())
  const [lists, setLists] = useState(() => getStoredLists())
  const [selectedListId, setSelectedListId] = useState(() => getStoredLists()[0].id)
  const [newListName, setNewListName] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [draggedItemId, setDraggedItemId] = useState('')
  const [dragOverItemId, setDragOverItemId] = useState('')
  const activeList = lists.find((list) => list.id === selectedListId) ?? lists[0]
  const selectedItems = items.filter((item) => (item.listId ?? DEFAULT_LIST_ID) === activeList.id)
  const urls = useObjectUrls(selectedItems)
  const hasItems = selectedItems.length > 0

  const listStats = useMemo(() => {
    return lists.reduce((stats, list) => {
      stats[list.id] = items.filter((item) => (item.listId ?? DEFAULT_LIST_ID) === list.id).length
      return stats
    }, {})
  }, [items, lists])

  async function refresh() {
    setItems(await getAllMedia())
    setIsLoading(false)
  }

  function updateLists(nextLists) {
    setLists(nextLists)
    saveStoredLists(nextLists)
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
          listId: activeList.id,
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
        ? `${mediaFiles.length} item${mediaFiles.length === 1 ? '' : 's'} added to ${activeList.name}.`
        : 'Only image and video files were added.',
    )
  }

  function handleCreateList(event) {
    event.preventDefault()
    const name = newListName.trim()
    if (!name) return

    const nextList = {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      name,
      createdAt: Date.now(),
    }

    updateLists([...lists, nextList])
    setSelectedListId(nextList.id)
    setNewListName('')
    setMessage(`${name} list created.`)
  }

  async function handleDeleteList() {
    if (lists.length === 1) {
      setMessage('At least one list is required.')
      return
    }

    await Promise.all(selectedItems.map((item) => deleteMedia(item.id)))
    const nextLists = lists.filter((list) => list.id !== activeList.id)
    updateLists(nextLists)
    setSelectedListId(nextLists[0].id)
    await refresh()
    setMessage(`${activeList.name} list removed.`)
  }

  async function handleRemove(id) {
    await deleteMedia(id)
    await refresh()
    setMessage('Media removed.')
  }

  async function handleClear() {
    await Promise.all(selectedItems.map((item) => deleteMedia(item.id)))
    await refresh()
    setMessage(`${activeList.name} cleared.`)
  }

  async function persistMediaOrder(reorderedItems) {
    const baseOrder = selectedItems[0]?.createdAt ?? 0

    await Promise.all(
      reorderedItems.map((item, index) =>
        updateMedia({
          ...item,
          createdAt: baseOrder + index,
        }),
      ),
    )

    await refresh()
    setMessage(`${activeList.name} order updated.`)
  }

  async function handleDropMedia(targetId) {
    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId('')
      setDragOverItemId('')
      return
    }

    const draggedIndex = selectedItems.findIndex((item) => item.id === draggedItemId)
    const targetIndex = selectedItems.findIndex((item) => item.id === targetId)

    if (draggedIndex < 0 || targetIndex < 0) return

    const reorderedItems = [...selectedItems]
    const [draggedItem] = reorderedItems.splice(draggedIndex, 1)
    reorderedItems.splice(targetIndex, 0, draggedItem)

    setDraggedItemId('')
    setDragOverItemId('')
    await persistMediaOrder(reorderedItems)
  }

  function openShowTab() {
    window.open(`/show/${encodeURIComponent(activeList.id)}`, '_blank', 'noopener,noreferrer')
  }

  function handleLogout() {
    clearCurrentUser()
    navigate('/login')
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="topbar">
          <div className="user-chip" aria-label="Logged in user">
            <span className="user-avatar">{(currentUser?.name ?? 'U').trim().charAt(0).toUpperCase()}</span>
            <div>
              <small>Logged in as</small>
              <strong>{currentUser?.name || currentUser?.email || 'User'}</strong>
            </div>
          </div>
          <button type="button" className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="toolbar">
          <div>
            <p className="eyebrow">Client-side ad playlists</p>
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

        <section className="list-manager" aria-label="Media lists">
          <div className="list-sidebar">
            <div className="list-sidebar-header">
              <div>
                <h2>Lists</h2>
                <p>{lists.length} ready</p>
              </div>
            </div>

            <form className="new-list-form" onSubmit={handleCreateList}>
              <input
                type="text"
                placeholder="New list name"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
              />
              <button type="submit" className="secondary-button">
                Add
              </button>
            </form>

            <div className="list-tabs" role="listbox" aria-label="Choose list">
              {lists.map((list) => (
                <button
                  type="button"
                  className={`list-tab ${list.id === activeList.id ? 'is-active' : ''}`}
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                >
                  <span>{list.name}</span>
                  <small>{listStats[list.id] ?? 0} items</small>
                </button>
              ))}
            </div>
          </div>

          <div className="list-summary">
            <div>
              <p className="eyebrow">Selected list</p>
              <h2>{activeList.name}</h2>
              <p>
                Add media here, remove items from this list, or launch only this list in the fullscreen display.
              </p>
            </div>
            <button type="button" className="text-button danger-text-button" onClick={handleDeleteList}>
              Delete list
            </button>
          </div>
        </section>

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
            <span>Files will be added to {activeList.name} and cached in this browser.</span>
          </div>
        </div>

        <div className="section-header">
          <div>
            <h2>{activeList.name} media</h2>
            <p>
              {isLoading
                ? 'Loading cache...'
                : `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} ready`}
            </p>
          </div>
          <button type="button" className="text-button" onClick={handleClear} disabled={!hasItems}>
            Remove list media
          </button>
        </div>

        {message && <p className="status">{message}</p>}

        {hasItems ? (
          <div className="media-grid">
            {selectedItems.map((item, index) => (
              <article
                className={`media-card ${draggedItemId === item.id ? 'is-dragging' : ''} ${
                  dragOverItemId === item.id ? 'is-drag-over' : ''
                }`}
                key={item.id}
                draggable
                onDragStart={(event) => {
                  setDraggedItemId(item.id)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', item.id)
                }}
                onDragEnd={() => {
                  setDraggedItemId('')
                  setDragOverItemId('')
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDragOverItemId(item.id)
                }}
                onDragLeave={() => {
                  setDragOverItemId((current) => (current === item.id ? '' : current))
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDropMedia(item.id)
                }}
              >
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
                  <div className="media-actions">
                    <span className="drag-handle" aria-label={`Drag ${item.name} to reorder`}>
                      Drag
                    </span>
                    <button type="button" className="remove-button" onClick={() => handleRemove(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No media in {activeList.name}</h2>
            <p>Add images or videos to this list, then use Show to launch this list fullscreen.</p>
          </div>
        )}
      </section>
    </main>
  )
}

export function Slideshow() {
  const { listId = DEFAULT_LIST_ID } = useParams()
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
        const selectedMedia = media.filter((item) => (item.listId ?? DEFAULT_LIST_ID) === listId)
        setItems(selectedMedia)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [listId])

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
    return (
      <main className="slideshow-screen">
        <p>Loading slideshow...</p>
      </main>
    )
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
      <div className="slide-backdrop" aria-hidden="true">
        {activeItem.type.startsWith('video/') ? (
          <video key={`backdrop-${activeItem.id}`} src={urls[activeItem.id]} muted playsInline autoPlay />
        ) : (
          <img key={`backdrop-${activeItem.id}`} src={urls[activeItem.id]} alt="" />
        )}
      </div>
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
