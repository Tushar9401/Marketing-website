import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  clearPlaylistMedia,
  createPlaylist,
  deleteMedia,
  deletePlaylist,
  fetchPlaylistMedia,
  fetchPlaylists,
  fetchPublicPlaylistMedia,
  reorderPlaylistMedia,
  updateMediaDuration,
  uploadPlaylistMedia,
} from '../api.js'
import { clearCurrentUser, getCurrentUser } from '../authSession.js'
import '../App.css'

const DEFAULT_IMAGE_DURATION_SECONDS = 5
const SLIDE_TRANSITION_DURATION = 650

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
  const [lists, setLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [newListName, setNewListName] = useState('')
  const [listError, setListError] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [draggedItemId, setDraggedItemId] = useState('')
  const [dragOverItemId, setDragOverItemId] = useState('')
  const activeList = lists.find((list) => String(list.id) === String(selectedListId))
  const selectedItems = items
  const hasItems = selectedItems.length > 0

  const listStats = useMemo(() => {
    return lists.reduce((stats, list) => {
      stats[list.id] = String(list.id) === String(selectedListId) ? selectedItems.length : list.itemCount
      return stats
    }, {})
  }, [lists, selectedItems.length, selectedListId])

  const authToken = currentUser?.token

  const loadPlaylists = useCallback(async () => {
    if (!authToken) return
    const data = await fetchPlaylists(authToken)
    setLists(data.playlists)
    setSelectedListId((current) => current || data.playlists[0]?.id || '')
  }, [authToken])

  const loadSelectedMedia = useCallback(async () => {
    if (!authToken || !selectedListId) return
    setIsLoading(true)
    const data = await fetchPlaylistMedia(authToken, selectedListId)
    setItems(data.media)
    setIsLoading(false)
  }, [authToken, selectedListId])

  useEffect(() => {
    if (!authToken) {
      navigate('/login')
      return
    }

    queueMicrotask(() => {
      loadPlaylists().catch((error) => {
        setMessage(error.message)
        setIsLoading(false)
      })
    })
  }, [authToken, loadPlaylists, navigate])

  useEffect(() => {
    queueMicrotask(() => {
      loadSelectedMedia().catch((error) => {
        setMessage(error.message)
        setIsLoading(false)
      })
    })
  }, [loadSelectedMedia])

  async function refreshAll() {
    await loadPlaylists()
    await loadSelectedMedia()
  }

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length || !activeList || !authToken) return

    setMessage('Adding media...')
    const mediaFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))

    try {
      await uploadPlaylistMedia(authToken, activeList.id, mediaFiles)
      event.target.value = ''
      await refreshAll()
      setMessage(
        mediaFiles.length === files.length
          ? `${mediaFiles.length} item${mediaFiles.length === 1 ? '' : 's'} added to ${activeList.name}.`
          : 'Only image and video files were added.',
      )
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function handleCreateList(event) {
    event.preventDefault()
    const name = newListName.trim()
    setListError('')
    if (!name || !authToken) return

    if (lists.some((list) => list.name.trim().toLowerCase() === name.toLowerCase())) {
      setListError('You already have a list with this name.')
      return
    }

    try {
      const data = await createPlaylist(authToken, name)
      await loadPlaylists()
      setSelectedListId(data.playlist.id)
      setItems([])
      setNewListName('')
      setMessage(`${name} list created.`)
    } catch (error) {
      setListError(error.message)
      setMessage(error.message)
    }
  }

  async function handleDeleteList() {
    if (!activeList || !authToken) return

    try {
      await deletePlaylist(authToken, activeList.id)
      const data = await fetchPlaylists(authToken)
      setLists(data.playlists)
      setSelectedListId(data.playlists[0]?.id || '')
      setItems([])
      setMessage(`${activeList.name} list removed.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function handleRemove(id) {
    if (!authToken) return

    try {
      await deleteMedia(authToken, id)
      await refreshAll()
      setMessage('Media removed.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  function handleDurationChange(itemId, value) {
    const durationSeconds = value === '' ? '' : Number(value)

    setItems((currentItems) =>
      currentItems.map((item) => (item.id === itemId ? { ...item, durationSeconds } : item)),
    )
  }

  async function saveDuration(item, value) {
    if (!authToken || item.type.startsWith('video/')) return

    const durationSeconds = Math.min(300, Math.max(1, Number(value) || DEFAULT_IMAGE_DURATION_SECONDS))

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, durationSeconds } : currentItem,
      ),
    )

    try {
      await updateMediaDuration(authToken, item.id, durationSeconds)
      setMessage(`${item.name} will show for ${durationSeconds} second${durationSeconds === 1 ? '' : 's'}.`)
    } catch (error) {
      setMessage(error.message)
      await loadSelectedMedia()
    }
  }

  async function handleClear() {
    if (!activeList || !authToken) return

    try {
      await clearPlaylistMedia(authToken, activeList.id)
      await refreshAll()
      setMessage(`${activeList.name} cleared.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function persistMediaOrder(reorderedItems) {
    if (!activeList || !authToken) return

    try {
      const data = await reorderPlaylistMedia(
        authToken,
        activeList.id,
        reorderedItems.map((item) => item.id),
      )
      setItems(data.media)
      await loadPlaylists()
      setMessage(`${activeList.name} order updated.`)
    } catch (error) {
      setMessage(error.message)
    }
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
    setItems(reorderedItems)
    await persistMediaOrder(reorderedItems)
  }

  function openShowTab() {
    if (!activeList) return
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
            <p className="eyebrow">Django powered ad playlists</p>
            <h1>Marketing Builder</h1>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()} disabled={!activeList}>
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
                onChange={(event) => {
                  setNewListName(event.target.value)
                  setListError('')
                }}
              />
              <button type="submit" className="secondary-button">
                Add
              </button>
            </form>
            {listError && <p className="list-error">{listError}</p>}

            <div className="list-tabs" role="listbox" aria-label="Choose list">
              {lists.map((list) => (
                <button
                  type="button"
                  className={`list-tab ${String(list.id) === String(selectedListId) ? 'is-active' : ''}`}
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
              <h2>{activeList?.name || 'Loading lists...'}</h2>
              <p>Add media here, remove items from this list, or launch only this list in the fullscreen display.</p>
            </div>
            <button type="button" className="text-button danger-text-button" onClick={handleDeleteList} disabled={!activeList}>
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
            <span>Files will be uploaded to {activeList?.name || 'the selected list'} in Django.</span>
          </div>
        </div>

        <div className="section-header">
          <div>
            <h2>{activeList?.name || 'Current'} media</h2>
            <p>
              {isLoading
                ? 'Loading media...'
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
                  event.dataTransfer.setData('text/plain', String(item.id))
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
                    <video src={item.url} muted playsInline />
                  ) : (
                    <img src={item.url} alt={item.name} />
                  )}
                  <span className="order-badge">{index + 1}</span>
                </div>
                <div className="media-meta">
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {item.type.startsWith('video/') ? 'Video' : 'Image'} · {formatBytes(item.size)}
                    </p>
                    {!item.type.startsWith('video/') && (
                      <label className="duration-control" onPointerDown={(event) => event.stopPropagation()}>
                        <span>Seconds</span>
                        <input
                          type="number"
                          min="1"
                          max="300"
                          step="1"
                          value={item.durationSeconds ?? DEFAULT_IMAGE_DURATION_SECONDS}
                          onChange={(event) => handleDurationChange(item.id, event.target.value)}
                          onBlur={(event) => saveDuration(item, event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                          }}
                        />
                      </label>
                    )}
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
            <h2>No media in {activeList?.name || 'this list'}</h2>
            <p>Add images or videos to this list, then use Show to launch this list fullscreen.</p>
          </div>
        )}
      </section>
    </main>
  )
}

export function Slideshow() {
  const { listId } = useParams()
  const videoRef = useRef(null)
  const transitionTimeoutRef = useRef(null)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isChanging, setIsChanging] = useState(false)
  const activeItem = items[activeIndex]

  useEffect(() => {
    if (!listId) {
      queueMicrotask(() => setIsLoading(false))
      return
    }

    queueMicrotask(() => {
      fetchPublicPlaylistMedia(listId)
        .then((data) => {
          setItems(data.media)
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    })
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
    const durationSeconds = Number(activeItem.durationSeconds) || DEFAULT_IMAGE_DURATION_SECONDS
    const timer = window.setTimeout(nextSlide, durationSeconds * 1000)
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
        <h1>No media in this list</h1>
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
          <video key={`backdrop-${activeItem.id}`} src={activeItem.url} muted playsInline autoPlay />
        ) : (
          <img key={`backdrop-${activeItem.id}`} src={activeItem.url} alt="" />
        )}
      </div>
      <div className="slide-stage">
        {activeItem.type.startsWith('video/') ? (
          <video
            ref={videoRef}
            key={activeItem.id}
            src={activeItem.url}
            className={`slide-media ${isChanging ? 'is-exiting' : ''}`}
            autoPlay
            muted
            playsInline
            onEnded={nextSlide}
          />
        ) : (
          <img
            key={activeItem.id}
            src={activeItem.url}
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
