const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

async function request(path, options = {}) {
  const headers = new Headers(options.headers)
  const token = options.token

  if (token) {
    headers.set('Authorization', `Token ${token}`)
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(data.error || 'Upload is too large. Ask the server to allow larger image and video uploads.')
    }

    throw new Error(data.error || 'Something went wrong.')
  }

  return data
}

export function signupUser(payload) {
  return request('/auth/signup/', {
    method: 'POST',
    body: payload,
  })
}

export function loginUser(payload) {
  return request('/auth/login/', {
    method: 'POST',
    body: payload,
  })
}

export function fetchPlaylists(token) {
  return request('/playlists/', { token })
}

export function createPlaylist(token, name) {
  return request('/playlists/', {
    method: 'POST',
    token,
    body: { name },
  })
}

export function deletePlaylist(token, playlistId) {
  return request(`/playlists/${playlistId}/`, {
    method: 'DELETE',
    token,
  })
}

export function fetchPlaylistMedia(token, playlistId) {
  return request(`/playlists/${playlistId}/media/`, { token })
}

export function uploadPlaylistMedia(token, playlistId, files) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  return request(`/playlists/${playlistId}/media/`, {
    method: 'POST',
    token,
    body: formData,
  })
}

export function clearPlaylistMedia(token, playlistId) {
  return request(`/playlists/${playlistId}/media/`, {
    method: 'DELETE',
    token,
  })
}

export function deleteMedia(token, mediaId) {
  return request(`/media/${mediaId}/`, {
    method: 'DELETE',
    token,
  })
}

export function reorderPlaylistMedia(token, playlistId, mediaIds) {
  return request(`/playlists/${playlistId}/media/reorder/`, {
    method: 'POST',
    token,
    body: { mediaIds },
  })
}

export function fetchPublicPlaylistMedia(playlistId) {
  return request(`/public/playlists/${playlistId}/media/`)
}
