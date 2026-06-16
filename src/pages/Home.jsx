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
  submitAdRequest,
  updateMediaDuration,
  uploadPlaylistMedia,
} from '../api.js'
import { clearCurrentUser, getCurrentUser } from '../authSession.js'
import '../App.css'

const DEFAULT_IMAGE_DURATION_SECONDS = 5
const SLIDE_TRANSITION_DURATION = 650
const MAX_LISTS_PER_USER = 5
const TEMPLATE_BASE_URL = import.meta.env.BASE_URL
const BRIGHT_CORE_LOGO = `${TEMPLATE_BASE_URL}bright-core-logo.jpeg`
const PROMO_TEMPLATES = [
  {
    id: 'beer',
    name: 'Beer',
    image: `${TEMPLATE_BASE_URL}templates/beer-template.png`,
    accent: '#d90404',
    textFill: '#ffffff',
  },
  {
    id: 'cigar',
    name: 'Cigar',
    image: `${TEMPLATE_BASE_URL}templates/cigar-template.png`,
    accent: '#7a3b12',
    textFill: '#ffe3a5',
  },
  {
    id: 'cigarettes',
    name: 'Cigarettes',
    image: `${TEMPLATE_BASE_URL}templates/cigarettes-template.png`,
    accent: '#073172',
    textFill: '#ffffff',
  },
  {
    id: 'coke',
    name: 'Coke',
    image: `${TEMPLATE_BASE_URL}templates/coke-template.png`,
    accent: '#d90404',
    textFill: '#ffffff',
  },
  {
    id: 'dairy',
    name: 'Dairy',
    image: `${TEMPLATE_BASE_URL}templates/Dairy Template.png`,
    accent: '#1c78a6',
    textFill: '#ffffff',
  },
  {
    id: 'health-beauty',
    name: 'Health & Beauty',
    image: `${TEMPLATE_BASE_URL}templates/Health And Beauty .png`,
    accent: '#0f8797',
    textFill: '#ffffff',
  },
  {
    id: 'perfumes',
    name: 'Perfumes',
    image: `${TEMPLATE_BASE_URL}templates/Perfumes Template.png`,
    accent: '#6f3fb2',
    textFill: '#ffffff',
  },
  {
    id: 'snacks',
    name: 'Snacks',
    image: `${TEMPLATE_BASE_URL}templates/Snacks Template.png`,
    accent: '#c8461e',
    textFill: '#ffffff',
  },
]

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** index
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(imageUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('Template image could not be loaded.'))
    }
    image.src = imageUrl
  })
}

function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Template background could not be loaded.'))
    image.src = src
  })
}

function drawOutlinedText(context, text, x, y, options = {}) {
  context.save()
  context.font = options.font
  context.textAlign = options.align ?? 'left'
  context.textBaseline = options.baseline ?? 'alphabetic'
  context.lineJoin = 'round'
  context.miterLimit = 2
  context.lineWidth = options.strokeWidth ?? 16
  context.strokeStyle = options.stroke ?? '#111827'
  context.fillStyle = options.fill ?? '#ffd32a'
  context.strokeText(text, x, y)
  context.fillText(text, x, y)
  context.restore()
}

function getWrappedLines(context, text, maxWidth) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines = []
  let line = ''

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word
    if (context.measureText(nextLine).width <= maxWidth || !line) {
      line = nextLine
      return
    }
    lines.push(line)
    line = word
  })

  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function parsePromoPriceText(text) {
  const cleanText = text.trim()
  const match = cleanText.match(/^(\d+)\s*(?:for|\/|x)?\s*\$?\s*([0-9]+(?:[.,][0-9]{1,2})?)\$?$/i)

  if (!match) return null

  const priceParts = match[2].replace(',', '.').split('.')
  return {
    quantity: match[1],
    dollars: priceParts[0],
    cents: priceParts[1] ?? '',
  }
}

function drawPricePromoText(context, parsedText) {
  drawOutlinedText(context, parsedText.quantity, 455, 174, {
    font: '900 245px Impact, Arial Black, sans-serif',
    align: 'center',
    baseline: 'middle',
    strokeWidth: 20,
    stroke: '#101010',
    fill: '#ffd21f',
  })

  drawOutlinedText(context, 'for', 675, 158, {
    font: '900 italic 92px "Arial Black", Arial, sans-serif',
    align: 'center',
    baseline: 'middle',
    strokeWidth: 14,
    stroke: '#101010',
    fill: '#ffffff',
  })

  drawOutlinedText(context, '$', 828, 164, {
    font: '900 142px Impact, Arial Black, sans-serif',
    align: 'center',
    baseline: 'middle',
    strokeWidth: 15,
    stroke: '#101010',
    fill: '#ffd21f',
  })

  drawOutlinedText(context, parsedText.dollars, 990, 164, {
    font: '900 220px Impact, Arial Black, sans-serif',
    align: 'center',
    baseline: 'middle',
    strokeWidth: 20,
    stroke: '#101010',
    fill: '#ffd21f',
  })

  if (parsedText.cents) {
    drawOutlinedText(context, '.', 1130, 176, {
      font: '900 110px Impact, Arial Black, sans-serif',
      align: 'center',
      baseline: 'middle',
      strokeWidth: 13,
      stroke: '#101010',
      fill: '#ffd21f',
    })

    drawOutlinedText(context, parsedText.cents.padEnd(2, '0').slice(0, 2), 1212, 111, {
      font: '900 136px Impact, Arial Black, sans-serif',
      align: 'center',
      baseline: 'middle',
      strokeWidth: 15,
      stroke: '#101010',
      fill: '#ffd21f',
    })
  }
}

function drawCenteredPromoText(context, text, template) {
  const cleanText = text.trim()
  if (!cleanText) return

  const parsedText = parsePromoPriceText(cleanText)
  if (parsedText) {
    drawPricePromoText(context, parsedText)
    return
  }

  const box = { x: 430, y: 54, width: 910, height: 220 }
  let fontSize = 112
  let lines

  do {
    context.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`
    lines = getWrappedLines(context, cleanText.toUpperCase(), box.width)
    fontSize -= 4
  } while (
    fontSize > 42 &&
    (lines.some((line) => context.measureText(line).width > box.width) || lines.length * (fontSize + 12) > box.height)
  )

  const lineHeight = fontSize + 14
  const startY = box.y + box.height / 2 - ((lines.length - 1) * lineHeight) / 2

  lines.forEach((line, index) => {
    drawOutlinedText(context, line, box.x + box.width / 2, startY + index * lineHeight, {
      font: `900 ${fontSize}px Impact, Arial Black, sans-serif`,
      align: 'center',
      baseline: 'middle',
      strokeWidth: Math.max(8, Math.round(fontSize * 0.11)),
      stroke: '#101010',
      fill: template.textFill,
    })
  })
}

function drawForegroundProduct(context, image) {
  const cropWidth = image.width * 0.72
  const cropHeight = image.height * 0.9
  const sourceX = (image.width - cropWidth) / 2
  const sourceY = image.height * 0.04
  const target = { x: 462, y: 238, width: 750, height: 660 }
  const imageRatio = cropWidth / cropHeight
  const boxRatio = target.width / target.height
  const drawWidth = imageRatio > boxRatio ? target.width : target.height * imageRatio
  const drawHeight = imageRatio > boxRatio ? target.width / imageRatio : target.height
  const offsetX = target.x + (target.width - drawWidth) / 2
  const offsetY = target.y + target.height - drawHeight

  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, offsetX, offsetY, drawWidth, drawHeight)
}

async function createPromoTemplateBlob({ template, imageFile, text }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1672
  canvas.height = 941
  const context = canvas.getContext('2d')
  const backgroundImage = await loadImageFromUrl(template.image)
  const productImage = imageFile ? await loadImageFromFile(imageFile) : null

  context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
  drawCenteredPromoText(context, text, template)

  if (productImage) {
    context.save()
    context.shadowColor = 'rgba(0, 0, 0, 0.42)'
    context.shadowBlur = 34
    context.shadowOffsetY = 24
    drawForegroundProduct(context, productImage)
    context.restore()
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
  if (!blob) {
    throw new Error('Template image could not be created.')
  }

  return blob
}

async function createPromoTemplateFile(options) {
  const blob = await createPromoTemplateBlob(options)
  const template = options.template
  return new File([blob], `${template.id}-${Date.now()}.png`, { type: 'image/png' })
}

export default function Home() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const templateInputRef = useRef(null)
  const templatePreviewUrlRef = useRef('')
  const generatedTemplatePreviewUrlRef = useRef('')
  const profileMenuRef = useRef(null)
  const [currentUser] = useState(() => getCurrentUser())
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [activeHomeTab, setActiveHomeTab] = useState('media')
  const [lists, setLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [newListName, setNewListName] = useState('')
  const [listError, setListError] = useState('')
  const [items, setItems] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(PROMO_TEMPLATES[0].id)
  const [templateImage, setTemplateImage] = useState(null)
  const [templateImagePreview, setTemplateImagePreview] = useState('')
  const [templateText, setTemplateText] = useState('2 for 5.99')
  const [generatedTemplatePreview, setGeneratedTemplatePreview] = useState('')
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [isSubmittingAdRequest, setIsSubmittingAdRequest] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [draggedItemId, setDraggedItemId] = useState('')
  const [dragOverItemId, setDragOverItemId] = useState('')
  const activeList = lists.find((list) => String(list.id) === String(selectedListId))
  const activeTemplate = PROMO_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? PROMO_TEMPLATES[0]
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

  useEffect(() => {
    return () => {
      if (templatePreviewUrlRef.current) {
        URL.revokeObjectURL(templatePreviewUrlRef.current)
      }
      if (generatedTemplatePreviewUrlRef.current) {
        URL.revokeObjectURL(generatedTemplatePreviewUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isProfileMenuOpen) return undefined

    function closeProfileMenu(event) {
      if (event.key === 'Escape' || !profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeProfileMenu)
    document.addEventListener('keydown', closeProfileMenu)

    return () => {
      document.removeEventListener('pointerdown', closeProfileMenu)
      document.removeEventListener('keydown', closeProfileMenu)
    }
  }, [isProfileMenuOpen])

  useEffect(() => {
    let isActive = true

    createPromoTemplateBlob({
      template: activeTemplate,
      imageFile: templateImage,
      text: templateText,
    })
      .then((blob) => {
        if (!isActive) return
        if (generatedTemplatePreviewUrlRef.current) {
          URL.revokeObjectURL(generatedTemplatePreviewUrlRef.current)
        }
        const imageUrl = URL.createObjectURL(blob)
        generatedTemplatePreviewUrlRef.current = imageUrl
        setGeneratedTemplatePreview(imageUrl)
      })
      .catch((error) => {
        if (isActive) setMessage(error.message)
      })

    return () => {
      isActive = false
    }
  }, [activeTemplate, templateImage, templateText])

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

  function handleTemplateImageSelected(event) {
    const file = Array.from(event.target.files ?? []).find((currentFile) => currentFile.type.startsWith('image/'))
    if (!file) return
    if (templatePreviewUrlRef.current) {
      URL.revokeObjectURL(templatePreviewUrlRef.current)
    }
    const imageUrl = URL.createObjectURL(file)
    templatePreviewUrlRef.current = imageUrl
    setTemplateImage(file)
    setTemplateImagePreview(imageUrl)
    event.target.value = ''
  }

  async function handleCreateTemplateMedia(event) {
    event.preventDefault()
    if (!activeList || !authToken) {
      setMessage('Choose a list before adding the generated image.')
      return
    }
    if (!templateText.trim() && !templateImage) {
      setMessage('Add text or a centre image first.')
      return
    }

    setIsCreatingTemplate(true)
    setMessage('Creating template image...')

    try {
      const templateFile = await createPromoTemplateFile({
        template: activeTemplate,
        imageFile: templateImage,
        text: templateText,
      })
      await uploadPlaylistMedia(authToken, activeList.id, [templateFile])
      await refreshAll()
      setActiveHomeTab('media')
      setMessage(`${activeTemplate.name} ad added to ${activeList.name}.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsCreatingTemplate(false)
    }
  }

  async function handleSubmitAdRequest() {
    if (!authToken) {
      setMessage('Please log in before submitting a request.')
      return
    }
    if (!templateText.trim() && !templateImage) {
      setMessage('Add text or a centre image before submitting the request.')
      return
    }

    setIsSubmittingAdRequest(true)
    setMessage('Submitting ad request...')

    try {
      const previewBlob = await createPromoTemplateBlob({
        template: activeTemplate,
        imageFile: templateImage,
        text: templateText,
      })
      const previewImage = new File([previewBlob], `${activeTemplate.id}-request-preview.png`, { type: 'image/png' })

      await submitAdRequest(authToken, {
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        templateImage: activeTemplate.image,
        text: templateText,
        playlistName: activeList?.name || '',
        previewImage,
        sourceImage: templateImage,
      })

      setMessage('Request submitted. We will share the finalized image in 2-3 hours during 9 AM-5 PM.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmittingAdRequest(false)
    }
  }

  async function handleCreateList(event) {
    event.preventDefault()
    const name = newListName.trim()
    setListError('')
    if (!name || !authToken) return

    if (lists.length >= MAX_LISTS_PER_USER) {
      setListError(`You can create up to ${MAX_LISTS_PER_USER} lists only.`)
      return
    }

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
          <div className="app-brand">
            <span className="brand-mark">M</span>
            <span>MarketFlow</span>
          </div>
          <div className="profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className={`profile-trigger ${isProfileMenuOpen ? 'is-open' : ''}`}
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              onClick={() => setIsProfileMenuOpen((current) => !current)}
            >
              <span className="user-avatar">{(currentUser?.name ?? 'U').trim().charAt(0).toUpperCase()}</span>
              <span className="profile-trigger-name">{currentUser?.name || currentUser?.email || 'User'}</span>
              <span className="profile-chevron" aria-hidden="true" />
            </button>

            {isProfileMenuOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="profile-dropdown-user">
                  <span className="user-avatar">{(currentUser?.name ?? 'U').trim().charAt(0).toUpperCase()}</span>
                  <div>
                    <small>Signed in as</small>
                    <strong>{currentUser?.name || 'User'}</strong>
                    {currentUser?.email && <span>{currentUser.email}</span>}
                  </div>
                </div>
                <button type="button" className="profile-logout" role="menuitem" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="toolbar">
          <div>
            <p className="eyebrow">Campaign workspace</p>
            <h1>Build displays that get noticed.</h1>
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

        <div className="home-tabs" role="tablist" aria-label="Home sections">
          <button
            type="button"
            className={`home-tab ${activeHomeTab === 'media' ? 'is-active' : ''}`}
            onClick={() => setActiveHomeTab('media')}
            role="tab"
            aria-selected={activeHomeTab === 'media'}
          >
            Media Library
          </button>
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
            {lists.length >= MAX_LISTS_PER_USER && (
              <p className="list-limit">List limit reached: {MAX_LISTS_PER_USER} of {MAX_LISTS_PER_USER} created.</p>
            )}
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

        {message && <p className="status">{message}</p>}

        {activeHomeTab === 'media' ? (
          <>
            <div className="drop-zone" onClick={() => inputRef.current?.click()} role="button" tabIndex="0">
              <div>
                <strong>Attach images and videos</strong>
                <span>Files will be uploaded to {activeList?.name || 'the selected list'}.</span>
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
          </>
        ) : (
          <section className="template-builder" aria-label="Ad designer">
            <div className="template-panel">
              <div className="template-copy">
                <p className="eyebrow">Ad Designer</p>
                <h2>Build a promo image</h2>
                <p>Choose one of the fixed backgrounds, add text, then place an image in the centre.</p>
              </div>

              <div className="template-options" role="radiogroup" aria-label="Choose template">
                {PROMO_TEMPLATES.map((template) => (
                  <button
                    type="button"
                    className={`template-option ${template.id === selectedTemplateId ? 'is-active' : ''}`}
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    role="radio"
                    aria-checked={template.id === selectedTemplateId}
                  >
                    <img src={template.image} alt="" />
                    <span>{template.name}</span>
                  </button>
                ))}
              </div>

              <form className="template-form" onSubmit={handleCreateTemplateMedia}>
                <input
                  ref={templateInputRef}
                  className="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleTemplateImageSelected}
                />

                <label className="template-text-field">
                  <span>Text</span>
                  <textarea
                    value={templateText}
                    onChange={(event) => setTemplateText(event.target.value)}
                    maxLength="80"
                  />
                </label>

                <div className="template-actions">
                  <button type="button" className="secondary-button" onClick={() => templateInputRef.current?.click()}>
                    {templateImage ? 'Change centre image' : 'Add centre image'}
                  </button>
                  {templateImagePreview && <img src={templateImagePreview} alt="Selected centre preview" />}
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!activeList || (!templateText.trim() && !templateImage) || isCreatingTemplate}
                  >
                    {isCreatingTemplate ? 'Adding...' : 'Add generated image'}
                  </button>
                </div>
              </form>
            </div>

            <div className="generated-preview">
              <div className="generated-preview-media">
                {generatedTemplatePreview ? (
                  <img src={generatedTemplatePreview} alt="Generated ad preview" />
                ) : (
                  <span>Rendering preview...</span>
                )}
              </div>
              <details className="ad-disclaimer preview-disclaimer" open>
                <summary>Ad request disclaimer</summary>
                <div className="ad-disclaimer-body">
                  <span>Preview only</span>
                  <span>Designer review before final</span>
                  <span>2-3 hour turnaround from 9 AM to 5 PM</span>
                </div>
                <p>
                  This is just a preview. To get the finalized image, please submit the request. The final ad may be
                  adjusted for spacing, alignment, clarity, and brand-safe presentation before delivery.
                </p>
              </details>
              <button
                type="button"
                className="request-button"
                onClick={handleSubmitAdRequest}
                disabled={(!templateText.trim() && !templateImage) || isSubmittingAdRequest}
              >
                {isSubmittingAdRequest ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </section>
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
      <div className="slide-powered-by" aria-label="Powered by Bright core Solutions">
        <img src={BRIGHT_CORE_LOGO} alt="" aria-hidden="true" />
        <span>Powered by Bright core Solutions</span>
      </div>
    </main>
  )
}
