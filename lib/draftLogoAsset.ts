/** Anonymous image bytes live here; object URLs are owned by this page session. */
const DATABASE = 'artistalks_draft_media_v1'
const STORE = 'logos'

export type DraftLogoAsset = {
  id: string
  blob: Blob
  name: string
  type: string
  lastModified: number
  uploads?: Record<string, string>
}

let generation = 0
let clearing = false
let database: Promise<IDBDatabase> | null = null
const urls = new Map<string, string>()
const assetIds = new Map<string, string>()
const sessionIds = new Set<string>()
const sessionFiles = new Map<string, File>()
const sessionUploads = new Map<string, Record<string, string>>()

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16)).join('-')
}

export function getDraftLogoGeneration() { return generation }
export function getCachedDraftLogoUrl(id: string) { return urls.get(id) ?? null }
export function getDraftLogoAssetId(url: string | null | undefined) { return url ? assetIds.get(url) ?? null : null }
export function isManagedDraftLogoUrl(url: string | null | undefined) { return !!getDraftLogoAssetId(url) }

function assertGeneration(expected: number) {
  if (expected !== generation) throw new Error('The local draft changed before the image finished saving.')
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database
  database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Local image storage is unavailable.')); return }
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onerror = () => reject(new Error('Local image storage could not be opened.'))
    request.onblocked = () => reject(new Error('Local image storage is busy. Close other ArtisTalks tabs and try again.'))
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); database = null }
      resolve(db)
    }
  }).catch(error => { database = null; throw error })
  return database
}

function cacheUrl(asset: DraftLogoAsset) {
  const existing = urls.get(asset.id)
  if (existing) return existing
  const url = URL.createObjectURL(asset.blob)
  urls.set(asset.id, url)
  assetIds.set(url, asset.id)
  return url
}

export async function readDraftLogoAsset(id: string): Promise<DraftLogoAsset | null> {
  const expected = generation
  const db = await openDatabase()
  assertGeneration(expected)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(id)
    tx.oncomplete = () => {
      if (expected !== generation) { reject(new Error('The local draft changed.')); return }
      const asset = request.result as DraftLogoAsset | undefined
      resolve(asset?.blob instanceof Blob ? asset : null)
    }
    tx.onerror = tx.onabort = () => reject(new Error('The saved image could not be read.'))
  })
}

export async function resolveDraftLogoUrl(id: string): Promise<string | null> {
  if (urls.has(id)) return urls.get(id)!
  const expected = generation
  const asset = await readDraftLogoAsset(id)
  assertGeneration(expected)
  return asset ? cacheUrl(asset) : null
}

export async function saveDraftLogoAsset(file: File): Promise<{ assetId: string; url: string }> {
  if (clearing) throw new Error('The local draft is being reset.')
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.')
  const expected = generation
  const db = await openDatabase()
  assertGeneration(expected)
  const asset: DraftLogoAsset = { id: randomId(), blob: file, name: file.name, type: file.type, lastModified: file.lastModified }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(asset)
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(new Error('This image could not be saved in this browser.'))
  })
  assertGeneration(expected)
  return { assetId: asset.id, url: cacheUrl(asset) }
}

export async function readDraftLogoUpload(id: string, userId: string): Promise<string | null> {
  return (await readDraftLogoAsset(id))?.uploads?.[userId] ?? null
}

export async function saveDraftLogoUpload(id: string, userId: string, url: string): Promise<void> {
  const expected = generation
  const db = await openDatabase()
  assertGeneration(expected)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const read = store.get(id)
    read.onsuccess = () => {
      const asset = read.result as DraftLogoAsset | undefined
      if (!asset || expected !== generation) { tx.abort(); return }
      store.put({ ...asset, uploads: { ...asset.uploads, [userId]: url } })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(new Error('The upload receipt could not be saved. Your local image is retained.'))
  })
  assertGeneration(expected)
}

/** Keep a selected File for this page session when durable storage cannot. */
export function retainSessionLogoFile(file: File, url: string, expectedGeneration: number): string {
  if (clearing || expectedGeneration !== generation) {
    throw new Error('The local draft changed before the image finished saving.')
  }
  const existing = assetIds.get(url)
  if (existing && sessionIds.has(existing)) return existing
  const id = randomId()
  sessionIds.add(id)
  sessionFiles.set(id, file)
  urls.set(id, url)
  assetIds.set(url, id)
  return id
}

export function readSessionLogoFile(id: string): File | null {
  return sessionFiles.get(id) ?? null
}

export function readSessionLogoUpload(id: string, userId: string): string | null {
  return sessionUploads.get(id)?.[userId] ?? null
}

export function rememberSessionLogoUpload(id: string, userId: string, url: string) {
  const receipts = sessionUploads.get(id) ?? {}
  receipts[userId] = url
  sessionUploads.set(id, receipts)
  sessionIds.add(id)
  sessionFiles.delete(id)
}

export function releaseSessionLogoUrl(url: string | null | undefined) {
  if (!url) return
  const id = assetIds.get(url)
  if (!id || !sessionIds.has(id)) return
  sessionIds.delete(id)
  sessionFiles.delete(id)
  sessionUploads.delete(id)
  if (urls.get(id) === url) urls.delete(id)
  if (assetIds.get(url) === id) assetIds.delete(url)
  URL.revokeObjectURL(url)
}

export function invalidateDraftLogoAssets() {
  generation += 1
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
  assetIds.clear()
  sessionIds.clear()
  sessionFiles.clear()
  sessionUploads.clear()
  return generation
}

export async function clearDraftLogoAssets(): Promise<void> {
  invalidateDraftLogoAssets()
  clearing = true
  try {
    if (typeof indexedDB === 'undefined') return
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () => reject(new Error('Local image cleanup could not finish.'))
    })
  } finally { clearing = false }
}
