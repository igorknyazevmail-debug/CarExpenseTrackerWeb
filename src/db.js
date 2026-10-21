import { supabase } from './lib/supabaseClient'

const INSTALLED_PART_PHOTO_BUCKET = 'installed-part-photos'
const MAX_INSTALLED_PART_PHOTOS = 5
const PHOTO_URL_TTL_SECONDS = 60 * 60 * 24
const PHOTO_URL_CACHE_KEY =
  'my-car-installed-part-photo-url-cache-v1'

const PHOTO_URL_CACHE_MARGIN_MS =
  5 * 60 * 1000

const photoUrlMemoryCache = new Map()
const MAX_PHOTO_SIZE_BYTES = 500 * 1024
const MAX_PHOTO_DIMENSION = 1600

function loadPhotoUrlCache() {
  try {
    const saved =
      localStorage.getItem(PHOTO_URL_CACHE_KEY)

    if (!saved) {
      return {}
    }

    const parsed = JSON.parse(saved)

    return parsed &&
      typeof parsed === 'object'
      ? parsed
      : {}
  } catch (error) {
    console.warn(
      'Не удалось прочитать кэш URL фотографий:',
      error
    )

    return {}
  }
}

function savePhotoUrlCache(cache) {
  try {
    localStorage.setItem(
      PHOTO_URL_CACHE_KEY,
      JSON.stringify(cache)
    )
  } catch (error) {
    console.warn(
      'Не удалось сохранить кэш URL фотографий:',
      error
    )
  }
}

function isPhotoUrlCacheValid(entry) {
  if (!entry?.url || !entry?.expiresAt) {
    return false
  }

  return (
    Date.now() <
    entry.expiresAt - PHOTO_URL_CACHE_MARGIN_MS
  )
}

export async function getInstalledPartPhotoUrl(filePath) {
  if (!filePath) {
    return ''
  }

  // 1. Сначала проверяем быстрый кэш в памяти.
  const memoryEntry =
    photoUrlMemoryCache.get(filePath)

  if (isPhotoUrlCacheValid(memoryEntry)) {
    return memoryEntry.url
  }

  // 2. Затем проверяем localStorage.
  const storedCache = loadPhotoUrlCache()
  const storedEntry = storedCache[filePath]

  if (isPhotoUrlCacheValid(storedEntry)) {
    photoUrlMemoryCache.set(
      filePath,
      storedEntry
    )

    return storedEntry.url
  }

  // 3. Если URL нет или он устарел —
  // получаем новый signed URL из Supabase.
  const { data, error } = await supabase.storage
    .from(INSTALLED_PART_PHOTO_BUCKET)
    .createSignedUrl(
      filePath,
      PHOTO_URL_TTL_SECONDS
    )

  if (error) {
    console.error(
      'Ошибка получения URL фото:',
      error
    )

    return ''
  }

  const url = data?.signedUrl || ''

  if (!url) {
    return ''
  }

  const entry = {
    url,
    expiresAt:
      Date.now() +
      PHOTO_URL_TTL_SECONDS * 1000,
  }

  // 4. Сохраняем и в память,
  // и в localStorage.
  photoUrlMemoryCache.set(
    filePath,
    entry
  )

  storedCache[filePath] = entry

  savePhotoUrlCache(storedCache)

  return url
}

export async function getAllExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Ошибка загрузки расходов:', error)
    throw error
  }

  return (data || []).map((expense) => ({
    id: expense.id,
    object: expense.object,
    date: expense.expense_date,
    category: expense.category,
    description: expense.description,
    mileage: expense.mileage,

fuelVolume:
  expense.fuel_volume_l == null
    ? null
    : Number(expense.fuel_volume_l),
fullTank: expense.is_full_tank ?? false,
amount: Number(expense.amount),
  }))
}

export async function saveExpense(expense) {
  const expenseData = {
    object: expense.object,
    expense_date: expense.date,
    category: expense.category,
    description: expense.description,
    mileage: expense.mileage ?? null,

fuel_volume_l:
  expense.category === 'Топливо' &&
  expense.fuelVolume != null
    ? Number(expense.fuelVolume)
    : null,

    is_full_tank:
  expense.category === 'Топливо'
    ? Boolean(expense.fullTank)
    : false,

amount: Number(expense.amount),
  }

  if (expense.id) {
    const { data, error } = await supabase
      .from('expenses')
      .update(expenseData)
      .eq('id', expense.id)
      .select()
      .single()

    if (error) {
      console.error('Ошибка обновления расхода:', error)
      throw error
    }

    return data.id
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert(expenseData)
    .select()
    .single()

  if (error) {
    console.error('Ошибка добавления расхода:', error)
    throw error
  }

  return data.id
}

export async function deleteExpense(expenseId) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)

  if (error) {
    console.error('Ошибка удаления расхода:', error)
    throw error
  }
}

export async function getInstalledParts() {
  const { data, error } = await supabase
    .from('installed_parts')
    .select(`
      *,
      installed_part_photos (
        id,
        file_path,
        sort_order,
        created_at
      )
    `)
    .order('installed_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error(
      'Ошибка загрузки установленных деталей:',
      error
    )
    throw error
  }

  return Promise.all(
    (data || []).map(async (part) => {
      const sortedPhotos = [
        ...(part.installed_part_photos || []),
      ].sort(
        (a, b) =>
          (a.sort_order || 0) -
          (b.sort_order || 0)
      )

      const photos = sortedPhotos.map((photo) => ({
  id: photo.id,
  path: photo.file_path,
  stored: true,
}))

      const {
        installed_part_photos,
        ...partData
      } = part

      return {
        id: partData.id,
        name: partData.part_name,
        category: partData.category || '',
        quantity: partData.quantity || 1,
        unit: partData.unit || 'шт.',
        installedDate: partData.installed_date,
        mileage: partData.mileage,
        serviceLifeKm: partData.service_life_km,
          replacementMileage: partData.replacement_mileage,
        manufacturer: partData.manufacturer || '',
        article: partData.article || '',
        oem: partData.oem || '',
        note: partData.note || '',
        photos,
      }
    })
  )
}

export async function saveInstalledPart(part) {
  const partData = {
    part_name: part.name,
    category: part.category || null,
    quantity: Number(part.quantity) || 1,
    unit: part.unit || 'шт.',
    installed_date: part.installedDate,
    mileage:
      part.mileage === '' || part.mileage == null
        ? null
        : Number(part.mileage),
        service_life_km:
  part.serviceLifeKm === '' ||
  part.serviceLifeKm == null
    ? null
    : Number(part.serviceLifeKm),

    replacement_mileage:
  part.replacementMileage === '' ||
  part.replacementMileage == null
    ? null
    : Number(part.replacementMileage),

    manufacturer: part.manufacturer || '',
    article: part.article || '',
    oem: part.oem || '',
    note: part.note || '',
  }

  if (part.id) {
    const { data, error } = await supabase
      .from('installed_parts')
      .update(partData)
      .eq('id', part.id)
      .select()
      .single()

    if (error) {
      console.error(
        'Ошибка обновления установленной детали:',
        error
      )
      throw error
    }

    return data.id
  }

  const { data, error } = await supabase
    .from('installed_parts')
    .insert(partData)
    .select()
    .single()

  if (error) {
    console.error(
      'Ошибка добавления установленной детали:',
      error
    )
    throw error
  }

  return data.id
}

export async function deleteInstalledPart(partId) {
  const { error } = await supabase
    .from('installed_parts')
    .delete()
    .eq('id', partId)

  if (error) {
    console.error(
      'Ошибка удаления установленной детали:',
      error
    )
    throw error
  }
}

async function compressPhoto(file) {
  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()

      img.onload = () => resolve(img)

      img.onerror = () =>
        reject(
          new Error(
            `Не удалось открыть изображение: ${file.name}`
          )
        )

      img.src = imageUrl
    })

    let width = image.naturalWidth
    let height = image.naturalHeight

    const longestSide = Math.max(width, height)

    if (longestSide > MAX_PHOTO_DIMENSION) {
      const scale =
        MAX_PHOTO_DIMENSION / longestSide

      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    // Если фото уже подходит и по размеру,
    // и по разрешению — оставляем оригинал.
    if (
      file.size <= MAX_PHOTO_SIZE_BYTES &&
      image.naturalWidth <= MAX_PHOTO_DIMENSION &&
      image.naturalHeight <= MAX_PHOTO_DIMENSION
    ) {
      return file
    }

    let quality = 0.88
    let blob = null

    while (true) {
      const canvas = document.createElement('canvas')

      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error(
          'Не удалось создать Canvas для сжатия фото.'
        )
      }

      context.fillStyle = '#ffffff'
      context.fillRect(
        0,
        0,
        width,
        height
      )

      context.drawImage(
        image,
        0,
        0,
        width,
        height
      )

      blob = await new Promise((resolve) => {
        canvas.toBlob(
          resolve,
          'image/jpeg',
          quality
        )
      })

      if (!blob) {
        throw new Error(
          'Не удалось сжать изображение.'
        )
      }

      // Фото уже меньше 0,5 MB.
      if (blob.size <= MAX_PHOTO_SIZE_BYTES) {
        break
      }

      // Сначала уменьшаем качество.
      if (quality > 0.5) {
        quality -= 0.08
        continue
      }

      // Если этого недостаточно —
      // немного уменьшаем разрешение.
      width = Math.round(width * 0.9)
      height = Math.round(height * 0.9)

      quality = 0.75

      if (width < 400 || height < 400) {
        break
      }
    }

    const originalName =
      file.name.replace(/\.[^/.]+$/, '')

    return new File(
      [blob],
      `${originalName}.jpg`,
      {
        type: 'image/jpeg',
        lastModified: Date.now(),
      }
    )
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export async function uploadInstalledPartPhotos(
  partId,
  files,
  currentPhotoCount = 0
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Пользователь не авторизован')
  }

  const availableSlots =
    MAX_INSTALLED_PART_PHOTOS - currentPhotoCount

  const filesToUpload = Array.from(files).slice(
    0,
    Math.max(0, availableSlots)
  )

  for (let index = 0; index < filesToUpload.length; index += 1) {
  const originalFile = filesToUpload[index]

  const file =
    await compressPhoto(originalFile)

  console.log(
    'Фото перед загрузкой:',
    originalFile.name,
    `${(originalFile.size / 1024 / 1024).toFixed(2)} MB`,
    '→',
    `${(file.size / 1024 / 1024).toFixed(2)} MB`
  )

  const extension =
    file.name.split('.').pop()?.toLowerCase() || 'jpg'

    const filePath =
      `${user.id}/${partId}/` +
      `${crypto.randomUUID()}.${extension}`

    const { error: uploadError } =
      await supabase.storage
        .from(INSTALLED_PART_PHOTO_BUCKET)
        .upload(filePath, file)

    if (uploadError) {
      console.error(
        'Ошибка загрузки фото:',
        uploadError
      )
      throw uploadError
    }

    const { error: dbError } = await supabase
      .from('installed_part_photos')
      .insert({
        part_id: partId,
        user_id: user.id,
        file_path: filePath,
        sort_order: currentPhotoCount + index,
      })

    if (dbError) {
      await supabase.storage
        .from(INSTALLED_PART_PHOTO_BUCKET)
        .remove([filePath])

      throw dbError
    }
  }
}

export async function deleteInstalledPartPhoto(photo) {
  if (!photo?.id || !photo?.path) {
    return
  }

  const { error: storageError } =
    await supabase.storage
      .from(INSTALLED_PART_PHOTO_BUCKET)
      .remove([photo.path])

  if (storageError) {
    console.error(
      'Ошибка удаления файла фото:',
      storageError
    )
    throw storageError
  }

  const { error: dbError } = await supabase
    .from('installed_part_photos')
    .delete()
    .eq('id', photo.id)

  if (dbError) {
    console.error(
      'Ошибка удаления записи фото:',
      dbError
    )
    throw dbError
    photoUrlMemoryCache.delete(photo.path)
}
const storedCache = loadPhotoUrlCache()

if (storedCache[photo.path]) {
  delete storedCache[photo.path]
  savePhotoUrlCache(storedCache)
}
  }

export async function getMaintenanceTasks() {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error(
      'Ошибка загрузки регламентных работ:',
      error
    )
    throw error
  }

  return (data || []).map((task) => ({
    id: task.id,
    name: task.name,
    lastServiceDate: task.last_service_date,
    lastServiceMileage: task.last_service_mileage,
    intervalKm: task.interval_km,
    intervalMonths: task.interval_months,
    nextServiceMileage: task.next_service_mileage,
    installedPartId: task.installed_part_id,
    note: task.note || '',
  }))
}

export async function saveMaintenanceTask(task) {
  const taskData = {
    name: task.name,
    last_service_date:
      task.lastServiceDate || null,

    last_service_mileage:
      task.lastServiceMileage === '' ||
      task.lastServiceMileage == null
        ? null
        : Number(task.lastServiceMileage),

next_service_mileage:
  task.nextServiceMileage === '' ||
  task.nextServiceMileage == null
    ? null
    : Number(task.nextServiceMileage),

    interval_km:
      task.intervalKm === '' ||
      task.intervalKm == null
        ? null
        : Number(task.intervalKm),

        interval_months:
  task.intervalMonths === '' ||
  task.intervalMonths == null
    ? null
    : Number(task.intervalMonths),
    
    installed_part_id:
      task.installedPartId || null,

    note: task.note || '',
  }

  if (task.id) {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update(taskData)
      .eq('id', task.id)
      .select()
      .single()

    if (error) {
      console.error(
        'Ошибка обновления регламентной работы:',
        error
      )
      throw error
    }

    return data.id
  }

  const { data, error } = await supabase
    .from('maintenance_tasks')
    .insert(taskData)
    .select()
    .single()

  if (error) {
    console.error(
      'Ошибка добавления регламентной работы:',
      error
    )
    throw error
  }

  return data.id
}

export async function deleteMaintenanceTask(taskId) {
  const { error } = await supabase
    .from('maintenance_tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    console.error(
      'Ошибка удаления регламентной работы:',
      error
    )
    throw error
  }
}
export async function getCurrentWorks() {
  const { data, error } = await supabase
    .from('current_works')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error(
      'Ошибка загрузки текущих работ:',
      error
    )
    throw error
  }

return (data || []).map((item) => ({
  id: item.id,
  text: item.text,
  priority: item.priority || 'medium',
}))
}

export async function addCurrentWork(
  text,
  priority = 'medium'
) {
  const { data, error } = await supabase
    .from('current_works')
    .insert({
      text: text.trim(),
        priority: priority,
    })
    .select()
    .single()

  if (error) {
    console.error(
      'Ошибка добавления текущей работы:',
      error
    )
    throw error
  }

  return data.id
}

export async function deleteCurrentWork(id) {
  const { error } = await supabase
    .from('current_works')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(
      'Ошибка удаления текущей работы:',
      error
    )
    throw error
  }
}

export async function updateCurrentWorkPriority(
  id,
  priority
) {
  const { error } = await supabase
    .from('current_works')
    .update({
      priority,
    })
    .eq('id', id)

  if (error) {
    console.error(
      'Ошибка изменения приоритета:',
      error
    )
    throw error
  }
}

export async function getPurchaseItems() {
  const { data, error } = await supabase
    .from('purchase_items')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error(
      'Ошибка загрузки списка покупок:',
      error
    )
    throw error
  }

  return (data || []).map((item) => ({
    id: item.id,
    text: item.text,
    priority: item.priority || 'medium',
  }))
}

export async function addPurchaseItem(
  text,
  priority = 'medium'
) {
  const { data, error } = await supabase
    .from('purchase_items')
    .insert({
      text: text.trim(),
      priority,
    })
    .select()
    .single()

  if (error) {
    console.error(
      'Ошибка добавления покупки:',
      error
    )
    throw error
  }

  return data.id
}

export async function updatePurchaseItemPriority(
  id,
  priority
) {
  const { error } = await supabase
    .from('purchase_items')
    .update({
      priority,
    })
    .eq('id', id)

  if (error) {
    console.error(
      'Ошибка изменения приоритета покупки:',
      error
    )
    throw error
  }
}

export async function deletePurchaseItem(id) {
  const { error } = await supabase
    .from('purchase_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(
      'Ошибка удаления покупки:',
      error
    )
    throw error
  }
}

export async function getCarNotes() {
  const { data, error } = await supabase
    .from('car_notes')
    .select('*')
    .order('updated_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      'Ошибка загрузки заметок:',
      error
    )
    throw error
  }

  return (data || []).map((note) => ({
    id: note.id,
    title: note.title || '',
    content: note.content || '',
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  }))
}

export async function saveCarNote(note) {
  const noteData = {
    title: note.title.trim(),
    content: note.content.trim(),
    updated_at: new Date().toISOString(),
  }

  if (note.id) {
    const { data, error } = await supabase
      .from('car_notes')
      .update(noteData)
      .eq('id', note.id)
      .select()
      .single()

    if (error) {
      console.error(
        'Ошибка обновления заметки:',
        error
      )
      throw error
    }

    return data.id
  }

  const { data, error } = await supabase
    .from('car_notes')
    .insert(noteData)
    .select()
    .single()

  if (error) {
    console.error(
      'Ошибка добавления заметки:',
      error
    )
    throw error
  }

  return data.id
}

export async function deleteCarNote(noteId) {
  const { error } = await supabase
    .from('car_notes')
    .delete()
    .eq('id', noteId)

  if (error) {
    console.error(
      'Ошибка удаления заметки:',
      error
    )
    throw error
  }
}