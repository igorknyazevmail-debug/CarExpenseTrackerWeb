import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { readSheet } from 'read-excel-file/browser'

import './App.css'
import AuthScreen from './AuthScreen'
import { supabase } from './lib/supabaseClient'

import {
    getCars,
  getAllExpenses,
  saveExpense,
  importExpenses,
  deleteExpense,
  getInstalledParts,
  getInstalledPartPhotoUrl,
  saveInstalledPart,
  deleteInstalledPart,
  uploadInstalledPartPhotos,
  deleteInstalledPartPhoto,
  getMaintenanceTasks,
  
saveMaintenanceTask,
deleteMaintenanceTask,
getCurrentWorks,
addCurrentWork,
deleteCurrentWork,
updateCurrentWorkPriority,
getPurchaseItems,
addPurchaseItem,
updatePurchaseItemPriority,
deletePurchaseItem,
getCarNotes,
saveCarNote,
deleteCarNote,
} from './db'

const initialExpenses = [
  {
    id: 1,
    date: '2026-10-09',
    category: 'Запчасти',
    description: 'Уплотнительное кольцо КПП',
    mileage: 182400,
    amount: 1.2,
  },
  {
    id: 2,
    date: '2026-10-07',
    category: 'Ремонт',
    description: 'Гидрокомпенсаторы',
    mileage: 182350,
    amount: 64,
  },
  {
    id: 3,
    date: '2026-10-05',
    category: 'Запчасти',
    description: 'Прокладки ГБЦ',
    mileage: 182300,
    amount: 38.5,
  },
]
const STORAGE_KEY = 'car-expense-tracker-expenses'

const carCategories = [
  'Запчасти',
  'Материалы',
  'Тюнинг',
  'Ремонт',
  'ТО',
  'Топливо',
  'Страховка',
  'Техосмотр',
  'Шины',
  'Мойка',
  'Налоги и сборы',
  'Прочее',
]

const installedPartCategories = [
  'Двигатель',
  'Охлаждение',
  'Впуск',
  'Выпуск',
  'Трансмиссия',
  'Подвеска',
  'Рулевое',
  'Тормоза',
  'Электрика',
  'Кузов',
  'Оборудование',
]

function formatMoney(value) {
  return new Intl.NumberFormat('lt-LT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-')
  return `${day}.${month}.${year}`
}
function getTodayDate() {
  const today = new Date()

  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function InstalledPartPhoto({
  photo,
  alt,
  onOpen,
  onDelete,
}) {
  const [photoUrl, setPhotoUrl] = useState('')

  useEffect(() => {
    let active = true

    async function loadPhoto() {
      if (!photo?.path) {
        return
      }

      const url =
        await getInstalledPartPhotoUrl(
          photo.path
        )

      if (active) {
        setPhotoUrl(url)
      }
    }

    loadPhoto()

    return () => {
      active = false
    }
  }, [photo?.path])

  return (
    <div className="installed-part-photo-wrapper">
      {photoUrl && (
        <button
          type="button"
          className="installed-part-photo-button"
          onClick={() => onOpen(photoUrl)}
        >
          <img
            src={photoUrl}
            alt={alt}
            className="installed-part-photo"
            loading="lazy"
            decoding="async"
          />
        </button>
      )}

      <button
        type="button"
        className="installed-part-photo-delete"
        onClick={() => onDelete(photo)}
        title="Удалить фото"
        aria-label="Удалить фото"
      >
        ×
      </button>
    </div>
  )
}

function normalizeExcelText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function excelRowsToObjects(rows) {
  if (!Array.isArray(rows)) {
    return []
  }

  const headerIndex =
    rows.findIndex((row) => {
      const cells =
        row.map(normalizeExcelText)

      return (
        cells.includes('дата') &&
        cells.some(
          (cell) =>
            cell === 'сумма' ||
            cell === 'стоимость'
        )
      )
    })

  if (headerIndex < 0) {
    return []
  }

  const headers =
    rows[headerIndex].map(
      (value) =>
        String(value ?? '').trim()
    )

  return rows
    .slice(headerIndex + 1)
    .map((row) => {
      const object = {}

      headers.forEach(
        (header, index) => {
          if (!header) {
            return
          }

          object[header] =
            row[index] ?? ''
        }
      )

      return object
    })
}

function getExcelCell(
  row,
  possibleNames
) {
  const keys =
    Object.keys(row)

  for (
    const name
    of possibleNames
  ) {
    const normalizedName =
      normalizeExcelText(name)

    const foundKey =
      keys.find(
        (key) =>
          normalizeExcelText(
            key
          ) === normalizedName
      )

    if (foundKey !== undefined) {
      return row[foundKey]
    }
  }

  return ''
}

function parseExcelNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : null
  }

  const normalized =
    String(value)
      .replace(/\u00a0/g, '')
      .replace(/\s/g, '')
      .replace(',', '.')

  const number =
    Number(normalized)

  return Number.isFinite(number)
    ? number
    : null
}

function parseExcelDate(value) {
  if (!value) {
    return null
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    const year =
      value.getFullYear()

    const month =
      String(
        value.getMonth() + 1
      ).padStart(2, '0')

    const day =
      String(
        value.getDate()
      ).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const text =
    String(value).trim()

  const isoMatch =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    )

  if (isoMatch) {
    return [
      isoMatch[1],
      isoMatch[2]
        .padStart(2, '0'),
      isoMatch[3]
        .padStart(2, '0'),
    ].join('-')
  }

  const europeanMatch =
    text.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    )

  if (europeanMatch) {
    return [
      europeanMatch[3],
      europeanMatch[2]
        .padStart(2, '0'),
      europeanMatch[1]
        .padStart(2, '0'),
    ].join('-')
  }

  return null
}

function parseExcelBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized =
    normalizeExcelText(value)

  return [
    'да',
    'yes',
    'true',
    '1',
    '✓',
    'x',
  ].includes(normalized)
}

function getExpenseImportKey(
  expense
) {
  const mileage =
    expense.mileage == null
      ? ''
      : Number(expense.mileage)

  const amount =
    Number(
      expense.amount || 0
    ).toFixed(2)

  const fuelVolume =
    expense.category === 'Топливо' &&
    expense.fuelVolume != null
      ? Number(
          expense.fuelVolume
        ).toFixed(2)
      : ''

  return [
    expense.date,
    expense.category,
    mileage,
    amount,
    fuelVolume,
  ].join('|')
}

function App() {
  const [session, setSession] = useState(null)

  const [cars, setCars] = useState([])
const [selectedCarId, setSelectedCarId] =
  useState('')
const [carsLoading, setCarsLoading] =
  useState(true)

const [authLoading, setAuthLoading] = useState(true)
useEffect(() => {
  let mounted = true

  async function loadSession() {
    try {
      const {
        data: {
          session: currentSession,
        },
        error,
      } =
        await supabase.auth.getSession()

      if (error) {
        console.error(
          'Ошибка проверки сессии:',
          error
        )
      }

      if (!mounted) {
        return
      }

      setSession(
        currentSession || null
      )
    } catch (error) {
      console.error(
        'Ошибка проверки входа:',
        error
      )

      if (mounted) {
        setSession(null)
      }
    } finally {
      if (mounted) {
        setAuthLoading(false)
      }
    }
  }

  loadSession()

  const {
    data: { subscription },
  } =
    supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!mounted) {
          return
        }

        setSession(
          currentSession || null
        )

        setAuthLoading(false)
      }
    )

  return () => {
    mounted = false

    subscription.unsubscribe()
  }
}, [])

useEffect(() => {
  async function loadCars() {
    if (!session) {
      setCars([])
      setSelectedCarId('')
      setCarsLoading(false)
      return
    }

    try {
      setCarsLoading(true)

      const data = await getCars()

      setCars(data)

      setSelectedCarId(
        (current) => {
          if (
            current &&
            data.some(
              (car) =>
                car.id === current
            )
          ) {
            return current
          }

          const citroen =
            data.find(
              (car) =>
                car.slug ===
                'citroen'
            )

          return (
            citroen?.id ||
            data[0]?.id ||
            ''
          )
        }
      )
    } catch (error) {
      console.error(
        'Ошибка загрузки автомобилей:',
        error
      )

      setCars([])
      setSelectedCarId('')
    } finally {
      setCarsLoading(false)
    }
  }

  loadCars()
}, [session?.user?.id])

const selectedCar =
  cars.find(
    (car) =>
      car.id === selectedCarId
  ) || null

const [expenses, setExpenses] = useState([])

const expenseImportInputRef =
  useRef(null)

const [
  expenseImporting,
  setExpenseImporting,
] = useState(false)

const [expensesLoading, setExpensesLoading] = useState(true)
const [installedParts, setInstalledParts] = useState([])
const [installedPartsLoading, setInstalledPartsLoading] = useState(true)
const [maintenanceTasks, setMaintenanceTasks] = useState([])
const [currentWorks, setCurrentWorks] = useState([])
const [currentWorksLoading, setCurrentWorksLoading] =
  useState(true)

const [currentWorkText, setCurrentWorkText] =
  useState('')
  const [currentWorkPriority, setCurrentWorkPriority] =
  useState('medium')
  const [purchaseItems, setPurchaseItems] = useState([])
const [purchaseItemsLoading, setPurchaseItemsLoading] =
  useState(true)

const [purchaseText, setPurchaseText] =
  useState('')

const [purchasePriority, setPurchasePriority] =
  useState('medium')

  const [carNotes, setCarNotes] =
  useState([])

const [
  carNotesLoading,
  setCarNotesLoading,
] = useState(true)

const [
  showNoteForm,
  setShowNoteForm,
] = useState(false)

const [
  editingNoteId,
  setEditingNoteId,
] = useState(null)

const [noteForm, setNoteForm] =
  useState({
    title: '',
    content: '',
  })

const [maintenanceLoading, setMaintenanceLoading] = useState(true)
const [maintenanceSortOrder, setMaintenanceSortOrder] =
  useState('asc')
const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
const [editingMaintenanceId, setEditingMaintenanceId] = useState(null)

const [
  expandedMaintenanceId,
  setExpandedMaintenanceId,
] = useState(null)

const [maintenanceSaving, setMaintenanceSaving] =
  useState(false)

const [maintenanceForm, setMaintenanceForm] = useState({
  name: '',
  lastServiceDate: getTodayDate(),
  lastServiceMileage: '',
  intervalKm: '',
  intervalMonths: '',
  nextServiceMileage: '',
  installedPartId: '',
  note: '',
})

const [citroenSection, setCitroenSection] = useState('home')

const [showPartForm, setShowPartForm] = useState(false)
const [editingPartId, setEditingPartId] = useState(null)
const [newPartPhotos, setNewPartPhotos] = useState([])
const [selectedInstalledPart, setSelectedInstalledPart] = useState(null)
const [openedPartPhoto, setOpenedPartPhoto] = useState(null)
const [
  installedPartSort,
  setInstalledPartSort,
] = useState({
  key: 'replacement',
  order: 'asc',
})

  const [
  installedPartCategory,
  setInstalledPartCategory,
] = useState('Все')
const [
  installedPartSearch,
  setInstalledPartSearch,
] = useState('')
const [partForm, setPartForm] = useState({
  name: '',
  category: installedPartCategories[0],
  quantity: 1,
    unit: 'шт.',
  installedDate: getTodayDate(),
  mileage: '',
  serviceLifeKm: '',
  replacementMileage: '',
  manufacturer: '',
  article: '',
  oem: '',
  note: '',
})

useEffect(() => {
  async function loadExpenses() {
    if (
  !session ||
  !selectedCarId
) {
      setExpenses([])
      setExpensesLoading(false)
      return
    }

    try {
      setExpensesLoading(true)

      const data =
  await getAllExpenses(
    selectedCarId
  )

      setExpenses(data)
    } catch (error) {
      console.error('Ошибка загрузки расходов:', error)
    } finally {
      setExpensesLoading(false)
    }
  }

  loadExpenses()
}, [
  session?.user?.id,
  selectedCarId,
])

useEffect(() => {
  async function loadInstalledParts() {
    if (
  !session ||
  !selectedCarId
) {
      setInstalledParts([])
      setInstalledPartsLoading(false)
      return
    }

    try {
      setInstalledPartsLoading(true)

      const data =
  await getInstalledParts(
    selectedCarId
  )

      setInstalledParts(data)
    } catch (error) {
      console.error(
        'Ошибка загрузки установленных деталей:',
        error
      )
    } finally {
      setInstalledPartsLoading(false)
    }
  }

  loadInstalledParts()
}, [
  session?.user?.id,
  selectedCarId,
])

useEffect(() => {
  async function loadMaintenanceTasks() {
    if (
  !session ||
  !selectedCarId
) {
      setMaintenanceTasks([])
      setMaintenanceLoading(false)
      return
    }

    try {
      setMaintenanceLoading(true)

      const data =
  await getMaintenanceTasks(
    selectedCarId
  )

      setMaintenanceTasks(data)
    } catch (error) {
      console.error(
        'Ошибка загрузки регламентных работ:',
        error
      )
    } finally {
      setMaintenanceLoading(false)
    }
  }

  loadMaintenanceTasks()
}, [
  session?.user?.id,
  selectedCarId,
])

useEffect(() => {
  async function loadCurrentWorks() {
    if (
  !session ||
  !selectedCarId
) {
      setCurrentWorks([])
      setCurrentWorksLoading(false)
      return
    }

    try {
      setCurrentWorksLoading(true)

      const data =
  await getCurrentWorks(
    selectedCarId
  )

      setCurrentWorks(data)
    } catch (error) {
      console.error(
        'Ошибка загрузки текущих работ:',
        error
      )
    } finally {
      setCurrentWorksLoading(false)
    }
  }

  loadCurrentWorks()
}, [
  session?.user?.id,
  selectedCarId,
])

useEffect(() => {
  async function loadPurchaseItems() {
    if (
  !session ||
  !selectedCarId
) {
      setPurchaseItems([])
      setPurchaseItemsLoading(false)
      return
    }

    try {
      setPurchaseItemsLoading(true)

      const data =
  await getPurchaseItems(
    selectedCarId
  )

      setPurchaseItems(data)
    } catch (error) {
      console.error(
        'Ошибка загрузки списка покупок:',
        error
      )
    } finally {
      setPurchaseItemsLoading(false)
    }
  }

  loadPurchaseItems()
}, [
  session?.user?.id,
  selectedCarId,
])

useEffect(() => {
  async function loadCarNotes() {
    if (
  !session ||
  !selectedCarId
) {
      setCarNotes([])
      setCarNotesLoading(false)
      return
    }

    try {
      setCarNotesLoading(true)

      const data =
  await getCarNotes(
    selectedCarId
  )

      setCarNotes(data)
    } catch (error) {
      console.error(
        'Ошибка загрузки заметок:',
        error
      )
    } finally {
      setCarNotesLoading(false)
    }
  }

  loadCarNotes()
}, [
  session?.user?.id,
  selectedCarId,
])

async function refreshPurchaseItems() {
  const data =
    await getPurchaseItems(
      selectedCarId
    )
  setPurchaseItems(data)
}

async function refreshCarNotes() {
  const data =
    await getCarNotes(
      selectedCarId
    )
  setCarNotes(data)
}

async function refreshCurrentWorks() {
  const data =
    await getCurrentWorks(
      selectedCarId
    )
  setCurrentWorks(data)
}

const currentWorkCounts = {
  high: currentWorks.filter(
    (item) => item.priority === 'high'
  ).length,

  medium: currentWorks.filter(
    (item) => item.priority === 'medium'
  ).length,

  low: currentWorks.filter(
    (item) => item.priority === 'low'
  ).length,

  buy: currentWorks.filter(
    (item) => item.priority === 'buy'
  ).length,
}

const purchaseCounts = {
  high: purchaseItems.filter(
    (item) => item.priority === 'high'
  ).length,

  medium: purchaseItems.filter(
    (item) => item.priority === 'medium'
  ).length,

  low: purchaseItems.filter(
    (item) => item.priority === 'low'
  ).length,
}

async function refreshMaintenanceTasks() {
  const data =
    await getMaintenanceTasks(
      selectedCarId
    )
  setMaintenanceTasks(data)

  return data
}

async function refreshInstalledParts() {
  const data =
    await getInstalledParts(
      selectedCarId
    )
  setInstalledParts(data)

  return data
}

async function refreshExpenses() {
  const data =
    await getAllExpenses(
      selectedCarId
    )
  setExpenses(data)
}

async function handleExpenseImport(
  event
) {
  const file =
    event.target.files?.[0]

  if (!file) {
    return
  }

  const citroenCar =
    cars.find(
      (car) =>
        String(
          car.slug || ''
        ).toLowerCase() ===
          'citroen' ||
        String(
          car.name || ''
        )
          .toLowerCase()
          .includes('citroen')
    )

  if (!citroenCar) {
    window.alert(
      'Автомобиль Citroen не найден.'
    )

    event.target.value = ''
    return
  }

  try {
    setExpenseImporting(true)

    const fuelRawRows =
      await readSheet(
        file,
        'Заправки'
      )

    const serviceRawRows =
      await readSheet(
        file,
        'Сервис'
      )

    const fuelRows =
      excelRowsToObjects(
        fuelRawRows
      )

    const serviceRows =
      excelRowsToObjects(
        serviceRawRows
      )

    const importedExpenses = []

    let skippedTools = 0
    let skippedRows = 0

    // Заправки
    for (const row of fuelRows) {
      const date =
        parseExcelDate(
          getExcelCell(
            row,
            [
              'Дата',
              'Дата и время',
            ]
          )
        )

      const mileage =
        parseExcelNumber(
          getExcelCell(
            row,
            ['Пробег']
          )
        )

      const amount =
        parseExcelNumber(
          getExcelCell(
            row,
            [
              'Сумма',
              'Стоимость',
            ]
          )
        )

      const fuelVolume =
        parseExcelNumber(
          getExcelCell(
            row,
            [
              'Количество',
              'Объём',
              'Объем',
            ]
          )
        )

      if (
        !date ||
        amount == null ||
        amount <= 0 ||
        fuelVolume == null ||
        fuelVolume <= 0
      ) {
        skippedRows += 1
        continue
      }

      const fuelType =
        String(
          getExcelCell(
            row,
            ['Вид топлива', 'Топливо']
          ) || ''
        ).trim()

      const station =
        String(
          getExcelCell(
            row,
            ['АЗС', 'Заправка']
          ) || ''
        ).trim()

      const comment =
        String(
          getExcelCell(
            row,
            [
              'Комментарий',
              'Примечание',
            ]
          ) || ''
        ).trim()

      const description =
        [
          fuelType,
          station,
          comment,
        ]
          .filter(Boolean)
          .join(' · ')

      const fullTank =
        parseExcelBoolean(
          getExcelCell(
            row,
            ['Полный бак', 'Полный']
          )
        )

      importedExpenses.push({
        date,
        category: 'Топливо',
        description,

        mileage:
          mileage == null
            ? null
            : Math.round(mileage),

        fuelVolume,
        fullTank,
        amount,
      })
    }

    // Сервис
    for (
      const row
      of serviceRows
    ) {
      const serviceType =
        normalizeExcelText(
          getExcelCell(
            row,
            [
              'Вид сервиса',
              'Категория',
            ]
          )
        )

      // Инструменты полностью
      // исключаем из импорта.
      if (
        serviceType.includes(
          'инструмент'
        )
      ) {
        skippedTools += 1
        continue
      }

      const categoryMap = {
        запчасть: 'Запчасти',
        запчасти: 'Запчасти',
        ремонт: 'Ремонт',
        то: 'ТО',
        материал: 'Материалы',
        материалы: 'Материалы',
        тюнинг: 'Тюнинг',
      }

      const category =
        categoryMap[
          serviceType
        ]

      if (!category) {
        skippedRows += 1
        continue
      }

      const date =
        parseExcelDate(
          getExcelCell(
            row,
            [
              'Дата',
              'Дата и время',
            ]
          )
        )

      const mileage =
        parseExcelNumber(
          getExcelCell(
            row,
            ['Пробег']
          )
        )

      const amount =
        parseExcelNumber(
          getExcelCell(
            row,
            [
              'Сумма',
              'Стоимость',
            ]
          )
        )

      if (
        !date ||
        amount == null ||
        amount <= 0
      ) {
        skippedRows += 1
        continue
      }

      const name =
        String(
          getExcelCell(
            row,
            [
              'Название',
              'Наименование',
            ]
          ) || ''
        ).trim()

      const details =
        String(
          getExcelCell(
            row,
            [
              'Виды работ и детали',
              'Работы и детали',
            ]
          ) || ''
        ).trim()

      const comment =
        String(
          getExcelCell(
            row,
            [
              'Комментарий',
              'Примечание',
            ]
          ) || ''
        ).trim()

      const description =
        [
          name,
          details,
          comment,
        ]
          .filter(Boolean)
          .filter(
            (
              value,
              index,
              array
            ) =>
              array.indexOf(
                value
              ) === index
          )
          .join(' — ')

      importedExpenses.push({
        date,
        category,
        description,

        mileage:
          mileage == null
            ? null
            : Math.round(mileage),

        fuelVolume: null,
        fullTank: false,
        amount,
      })
    }

    const existingExpenses =
      await getAllExpenses(
        citroenCar.id
      )

    const existingKeys =
      new Set(
        existingExpenses.map(
          getExpenseImportKey
        )
      )

    const fileKeys =
      new Set()

    const expensesToImport = []

    let duplicates = 0

    for (
      const expense
      of importedExpenses
    ) {
      const key =
        getExpenseImportKey(
          expense
        )

      if (
        existingKeys.has(key) ||
        fileKeys.has(key)
      ) {
        duplicates += 1
        continue
      }

      fileKeys.add(key)

      expensesToImport.push(
        expense
      )
    }

    const message = [
      `Найдено расходов: ${importedExpenses.length}`,
      `Инструменты пропущены: ${skippedTools}`,
      `Дубликаты пропущены: ${duplicates}`,
      `Другие пропущенные строки: ${skippedRows}`,
      `Будет добавлено: ${expensesToImport.length}`,
    ].join('\n')

    if (
      expensesToImport.length ===
      0
    ) {
      window.alert(
        `${message}\n\nНовых расходов для импорта нет.`
      )
      return
    }

    const confirmed =
      window.confirm(
        `${message}\n\nИмпортировать в Citroen?`
      )

    if (!confirmed) {
      return
    }

    await importExpenses(
      citroenCar.id,
      expensesToImport
    )

    setSelectedCarId(
      citroenCar.id
    )

    setCitroenSection(
      'expenses'
    )

    const updatedExpenses =
      await getAllExpenses(
        citroenCar.id
      )

    setExpenses(
      updatedExpenses
    )

    window.alert(
      `Импорт завершён.\n\nДобавлено: ${expensesToImport.length}\nИнструменты пропущены: ${skippedTools}\nДубликаты пропущены: ${duplicates}`
    )
  } catch (error) {
    console.error(
      'Ошибка импорта Excel:',
      error
    )

    window.alert(
      'Не удалось импортировать Excel-файл. Откройте F12 → Console для подробностей.'
    )
  } finally {
    setExpenseImporting(
      false
    )

    event.target.value = ''
  }
}

const [showForm, setShowForm] = useState(false)

const [editingExpenseId, setEditingExpenseId] = useState(null)

const [
  expandedExpenseId,
  setExpandedExpenseId,
] = useState(null)

const [expensePeriod, setExpensePeriod] =
  useState('12')

  const [form, setForm] = useState({
  date: getTodayDate(),
  category: 'Запчасти',
  description: '',
  mileage: '',
    fuelVolume: '',
      fullTank: false,
  amount: '',
})

const filteredExpenses = expenses

const periodExpenses = useMemo(() => {
  if (expensePeriod === 'all') {
    return filteredExpenses
  }

  const months =
    Number(expensePeriod)

  const now = new Date()

  const startDate = new Date(
    now.getFullYear(),
    now.getMonth() - months,
    now.getDate(),
    0,
    0,
    0,
    0
  )

  return filteredExpenses.filter(
    (expense) => {
      if (!expense.date) {
        return false
      }

      const expenseDate =
        new Date(
          `${expense.date}T12:00:00`
        )

      return expenseDate >= startDate
    }
  )
}, [
  filteredExpenses,
  expensePeriod,
])

const periodTotal = useMemo(() => {
  return periodExpenses.reduce(
    (sum, expense) =>
      sum + Number(expense.amount || 0),
    0
  )
}, [periodExpenses])

const periodMileageStats = useMemo(() => {
  const now = new Date()

  const mileageEntries =
    filteredExpenses
      .filter(
        (expense) =>
          expense.date &&
          expense.mileage !== null &&
          expense.mileage !== undefined &&
          expense.mileage !== '' &&
          Number.isFinite(
            Number(expense.mileage)
          )
      )
      .map((expense) => ({
        date: new Date(
          `${expense.date}T12:00:00`
        ),
        mileage: Number(
          expense.mileage
        ),
      }))
      .sort((a, b) => {
        const dateDifference =
          a.date - b.date

        if (dateDifference !== 0) {
          return dateDifference
        }

        return (
          a.mileage - b.mileage
        )
      })

  if (mileageEntries.length < 2) {
    return {
      distanceKm: null,
      costPerKm: null,
    }
  }

  let startEntry = null

  if (expensePeriod === 'all') {
    startEntry =
      mileageEntries[0]
  } else {
    const months =
      Number(expensePeriod)

    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - months,
      now.getDate(),
      0,
      0,
      0,
      0
    )

    const beforeStart =
      mileageEntries.filter(
        (entry) =>
          entry.date <= startDate
      )

    if (beforeStart.length > 0) {
      startEntry =
        beforeStart[
          beforeStart.length - 1
        ]
    } else {
      startEntry =
        mileageEntries.find(
          (entry) =>
            entry.date >= startDate &&
            entry.date <= now
        ) || null
    }
  }

  const endEntries =
    mileageEntries.filter(
      (entry) =>
        entry.date <= now
    )

  const endEntry =
    endEntries.length > 0
      ? endEntries[
          endEntries.length - 1
        ]
      : null

  if (!startEntry || !endEntry) {
    return {
      distanceKm: null,
      costPerKm: null,
    }
  }

  const distanceKm =
    endEntry.mileage -
    startEntry.mileage

  if (
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0
  ) {
    return {
      distanceKm: null,
      costPerKm: null,
    }
  }

  return {
    distanceKm,
    costPerKm:
      periodTotal / distanceKm,
  }
}, [
  filteredExpenses,
  expensePeriod,
  periodTotal,
])

function getExpensePeriodLabel() {
  switch (expensePeriod) {
    case '1':
      return 'За 1 месяц'

    case '3':
      return 'За 3 месяца'

    case '6':
      return 'За 6 месяцев'

    case '12':
      return 'За 12 месяцев'

    case 'all':
      return 'За всё время'

    default:
      return 'Расходы'
  }
}

const fuelPeriodStats = useMemo(() => {
  const now = new Date()

  let startDate = null

  if (expensePeriod !== 'all') {
  const months =
    Number(expensePeriod)

    startDate = new Date(
      now.getFullYear(),
      now.getMonth() - months,
      now.getDate(),
      0,
      0,
      0,
      0
    )
  }

  const allFuelExpenses =
    filteredExpenses
      .filter((expense) => {
        if (
          expense.category !== 'Топливо' ||
          !expense.date ||
          !expense.fuelVolume ||
          Number(expense.fuelVolume) <= 0 ||
          !expense.amount ||
          Number(expense.amount) <= 0
        ) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        const dateDifference =
          new Date(
            `${a.date}T12:00:00`
          ) -
          new Date(
            `${b.date}T12:00:00`
          )

        if (dateDifference !== 0) {
          return dateDifference
        }

        return (
          Number(a.mileage || 0) -
          Number(b.mileage || 0)
        )
      })

  const periodFuelExpenses =
    allFuelExpenses.filter(
      (expense) => {
        const expenseDate =
          new Date(
            `${expense.date}T12:00:00`
          )

        if (expenseDate > now) {
          return false
        }

        if (
          startDate &&
          expenseDate < startDate
        ) {
          return false
        }

        return true
      }
    )

  const totalLiters =
    periodFuelExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense.fuelVolume || 0
        ),
      0
    )

  const totalCost =
    periodFuelExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense.amount || 0
        ),
      0
    )

  const averagePrice =
    totalLiters > 0
      ? totalCost / totalLiters
      : null

  /*
    Расход на 1 км считаем
    только по завершённым
    интервалам:
    полный бак → полный бак.
  */

  const fuelWithMileage =
    allFuelExpenses.filter(
      (expense) =>
        expense.mileage !== null &&
        expense.mileage !== undefined &&
        Number.isFinite(
          Number(expense.mileage)
        )
    )

  let previousFullTankIndex =
    null

  let completedDistance = 0
  let completedCost = 0

  for (
    let index = 0;
    index < fuelWithMileage.length;
    index += 1
  ) {
    const expense =
      fuelWithMileage[index]

    if (!expense.fullTank) {
      continue
    }

    if (
      previousFullTankIndex !== null
    ) {
      const previousFullTank =
        fuelWithMileage[
          previousFullTankIndex
        ]

      const distance =
        Number(expense.mileage) -
        Number(
          previousFullTank.mileage
        )

      const intervalCost =
        fuelWithMileage
          .slice(
            previousFullTankIndex + 1,
            index + 1
          )
          .reduce(
            (sum, fuelExpense) =>
              sum +
              Number(
                fuelExpense.amount || 0
              ),
            0
          )

      const intervalEndDate =
        new Date(
          `${expense.date}T12:00:00`
        )

      const intervalInPeriod =
        intervalEndDate <= now &&
        (
          !startDate ||
          intervalEndDate >=
            startDate
        )

      if (
        intervalInPeriod &&
        distance > 0 &&
        intervalCost > 0
      ) {
        completedDistance +=
          distance

        completedCost +=
          intervalCost
      }
    }

    previousFullTankIndex =
      index
  }

  const costPerKm =
    completedDistance > 0
      ? completedCost /
        completedDistance
      : null

  return {
    totalLiters,
    totalCost,
    averagePrice,
    costPerKm,
    completedDistance,
    refuelCount:
      periodFuelExpenses.length,
  }
}, [
  filteredExpenses,
  expensePeriod,
])

const sortedMaintenanceTasks = useMemo(() => {
  return [...maintenanceTasks].sort((a, b) => {
    function getSortInfo(task) {
      const nextMileage =
        getMaintenanceNextMileage(task)

      const currentMileage =
        Number(getLastMileage())

      const remainingKm =
        nextMileage &&
        currentMileage
          ? nextMileage - currentMileage
          : null

      const nextDate =
        getMaintenanceNextDate(task)

      const remainingDays =
        nextDate
          ? getDaysUntilDate(nextDate)
          : null

      const status =
        getMaintenanceStatus(task)

      /*
        Для просроченных считаем,
        насколько сильно превышен срок.

        500 км просрочки = 1 условная единица
        30 дней просрочки = 1 условная единица.
      */
      const overdueKmScore =
        remainingKm !== null &&
        remainingKm <= 0
          ? Math.abs(remainingKm) / 500
          : 0

      const overdueDaysScore =
        remainingDays !== null &&
        remainingDays <= 0
          ? Math.abs(remainingDays) / 30
          : 0

      const overdueScore =
        Math.max(
          overdueKmScore,
          overdueDaysScore
        )

      /*
        Для приближающихся работ:
        чем меньше значение, тем ближе срок.

        250 км → 0.5
        15 дней → 0.5
      */
      const soonScores = []

      if (
        remainingKm !== null &&
        remainingKm > 0 &&
        remainingKm <= 500
      ) {
        soonScores.push(
          remainingKm / 500
        )
      }

      if (
        remainingDays !== null &&
        remainingDays > 0 &&
        remainingDays <= 30
      ) {
        soonScores.push(
          remainingDays / 30
        )
      }

      const soonScore =
        soonScores.length > 0
          ? Math.min(...soonScores)
          : Infinity

      return {
        status,
        overdueScore,
        soonScore,
        nextMileage,
      }
    }

    const infoA = getSortInfo(a)
    const infoB = getSortInfo(b)

    const statusOrder = {
      overdue: 0,
      soon: 1,
      normal: 2,
    }

    const orderA =
      statusOrder[infoA.status] ?? 2

    const orderB =
      statusOrder[infoB.status] ?? 2

    // 1. Сначала по статусу
    if (orderA !== orderB) {
      return orderA - orderB
    }

    // 2. Среди просроченных:
    // сильнее просроченные выше
    if (
      infoA.status === 'overdue' &&
      infoB.status === 'overdue'
    ) {
      if (
        infoA.overdueScore !==
        infoB.overdueScore
      ) {
        return (
          infoB.overdueScore -
          infoA.overdueScore
        )
      }
    }

    // 3. Среди приближающихся:
    // ближайший срок выше
    if (
      infoA.status === 'soon' &&
      infoB.status === 'soon'
    ) {
      if (
        infoA.soonScore !==
        infoB.soonScore
      ) {
        return (
          infoA.soonScore -
          infoB.soonScore
        )
      }
    }

    // 4. Для одинакового приоритета
    // оставляем сортировку по пробегу
    const nextA =
      infoA.nextMileage

    const nextB =
      infoB.nextMileage

    if (
      nextA == null &&
      nextB == null
    ) {
      return 0
    }

    if (nextA == null) {
      return 1
    }

    if (nextB == null) {
      return -1
    }

    if (
      maintenanceSortOrder === 'asc'
    ) {
      return nextA - nextB
    }

    return nextB - nextA
  })
}, [
  maintenanceTasks,
  maintenanceSortOrder,
  installedParts,
  expenses,
])

const dashboardInstalledParts =
  installedParts
    .filter((part) => {
      const status =
        getRemainingMileageStatus(part)

      return (
        status === 'soon' ||
        status === 'overdue'
      )
    })
    .sort((a, b) => {
      const remainingA =
        getRemainingMileage(a)

      const remainingB =
        getRemainingMileage(b)

      if (
        remainingA == null &&
        remainingB == null
      ) {
        return 0
      }

      if (remainingA == null) {
        return 1
      }

      if (remainingB == null) {
        return -1
      }

      return remainingA - remainingB
    })

const dashboardMaintenanceTasks =
  sortedMaintenanceTasks.filter(
    (task) => {
      const status =
        getMaintenanceStatus(task)

      return (
        status === 'soon' ||
        status === 'overdue'
      )
    }
  )

const dashboardCurrentWorks =
  currentWorks.filter(
    (item) =>
      item.priority === 'high'
  )

const dashboardPurchaseItems =
  purchaseItems.filter(
    (item) =>
      item.priority === 'high'
  )

function handleChange(event) {
  const {
    name,
    value,
    type,
    checked,
  } = event.target

  setForm((current) => ({
    ...current,

    [name]:
      type === 'checkbox'
        ? checked
        : value,

    ...(name === 'category' &&
    value === 'Топливо'
      ? { description: '' }
      : {}),
  }))
}

function getLastMileage() {
  const lastExpenseWithMileage =
    expenses.find(
      (expense) =>
        expense.mileage !== null &&
        expense.mileage !== undefined
    )

  return (
    lastExpenseWithMileage?.mileage ??
    ''
  )
}

function getReplacementMileage(part) {
  if (part.replacementMileage) {
    return Number(part.replacementMileage)
  }

  const installationMileage = Number(part.mileage)
  const serviceLifeKm = Number(part.serviceLifeKm)

  if (!installationMileage || !serviceLifeKm) {
    return null
  }

  return installationMileage + serviceLifeKm
}

function getPartWearMileage(part) {
  const currentMileage =
    Number(getLastMileage())

  const installationMileage =
    Number(part.mileage)

  if (
    !Number.isFinite(currentMileage) ||
    !Number.isFinite(installationMileage) ||
    currentMileage <= 0 ||
    installationMileage <= 0
  ) {
    return null
  }

  if (
    currentMileage <
    installationMileage
  ) {
    return null
  }

  return (
    currentMileage -
    installationMileage
  )
}

function getPartRemainingMileage(part) {
  const replacementMileage =
    getReplacementMileage(part)

  const currentMileage =
    Number(getLastMileage())

  if (
    replacementMileage == null ||
    !Number.isFinite(currentMileage) ||
    currentMileage <= 0
  ) {
    return null
  }

  return (
    replacementMileage -
    currentMileage
  )
}

function handleInstalledPartSort(key) {
  setInstalledPartSort((current) => {
    if (current.key === key) {
      return {
        key,
        order:
          current.order === 'asc'
            ? 'desc'
            : 'asc',
      }
    }

    return {
      key,
      order: 'asc',
    }
  })
}

function getInstalledPartSortArrow(key) {
  if (installedPartSort.key !== key) {
    return ''
  }

  return installedPartSort.order === 'asc'
    ? '↑'
    : '↓'
}

function getInstalledPartSortValue(
  part,
  key
) {
  switch (key) {
    case 'date':
      return part.installedDate || ''

    case 'name':
      return part.name || ''

    case 'installed':
      return Number(part.mileage) || null

    case 'wear':
      return getPartWearMileage(part)

    case 'resource':
      return Number(
        part.serviceLifeKm
      ) || null

    case 'replacement':
      return getReplacementMileage(part)

    case 'remaining':
      return getPartRemainingMileage(part)

    default:
      return null
  }
}

function compareInstalledParts(a, b) {
  const valueA =
    getInstalledPartSortValue(
      a,
      installedPartSort.key
    )

  const valueB =
    getInstalledPartSortValue(
      b,
      installedPartSort.key
    )

  // Пустые значения всегда внизу
  if (
    valueA == null &&
    valueB == null
  ) {
    return 0
  }

  if (valueA == null) {
    return 1
  }

  if (valueB == null) {
    return -1
  }

  let result = 0

  if (
    installedPartSort.key ===
      'name' ||
    installedPartSort.key ===
      'date'
  ) {
    result = String(valueA).localeCompare(
      String(valueB),
      'ru',
      {
        sensitivity: 'base',
      }
    )
  } else {
    result =
      Number(valueA) -
      Number(valueB)
  }

  return installedPartSort.order ===
    'asc'
    ? result
    : -result
}

function isReplacementOverdue(part) {
  const replacementMileage = getReplacementMileage(part)
  const currentMileage = Number(getLastMileage())

  if (!replacementMileage || !currentMileage) {
    return false
  }

  return currentMileage > replacementMileage
}

function getRemainingMileage(part) {
  const replacementMileage =
    getReplacementMileage(part)

  const currentMileage =
    Number(getLastMileage())

  if (
    replacementMileage == null ||
    !Number.isFinite(currentMileage) ||
    currentMileage <= 0
  ) {
    return null
  }

  return (
    Number(replacementMileage) -
    currentMileage
  )
}

function getRemainingMileageStatus(part) {
  const remaining =
    getRemainingMileage(part)

  if (remaining == null) {
    return ''
  }

  if (remaining <= 0) {
    return 'overdue'
  }

  if (remaining <= 500) {
    return 'soon'
  }

  return 'normal'
}

function formatRemainingMileage(part) {
  const remaining =
    getRemainingMileage(part)

  if (remaining == null) {
    return '—'
  }

  if (remaining < 0) {
    return `Просрочено ${Math.abs(
      remaining
    ).toLocaleString('lt-LT')} км`
  }

  if (remaining === 0) {
    return 'Пора менять'
  }

  return `${remaining.toLocaleString(
    'lt-LT'
  )} км`
}

function formatPartQuantity(part) {
  const quantity =
    Number(part.quantity ?? 1)

  const unit =
    part.unit || 'шт.'

  if (!Number.isFinite(quantity)) {
    return `1 ${unit}`
  }

  return `${quantity.toLocaleString(
    'lt-LT',
    {
      maximumFractionDigits: 3,
    }
  )} ${unit}`
}

function getMaintenanceLinkedPart(task) {
  if (!task.installedPartId) {
    return null
  }

  return (
    installedParts.find(
      (part) => part.id === task.installedPartId
    ) || null
  )
}

function getMaintenanceInterval(task) {
  const linkedPart = getMaintenanceLinkedPart(task)

  if (linkedPart?.serviceLifeKm) {
    return Number(linkedPart.serviceLifeKm)
  }

  if (task.intervalKm) {
    return Number(task.intervalKm)
  }

  return null
}

function getMaintenanceNextMileage(task) {
  if (task.nextServiceMileage) {
    return Number(task.nextServiceMileage)
  }

  const linkedPart = getMaintenanceLinkedPart(task)

  if (linkedPart) {
    return getReplacementMileage(linkedPart)
  }

  if (
    task.lastServiceMileage &&
    task.intervalKm
  ) {
    return (
      Number(task.lastServiceMileage) +
      Number(task.intervalKm)
    )
  }

  return null
}

function addMonthsToDateString(
  dateString,
  months
) {
  if (!dateString || !months) {
    return null
  }

  const [year, month, day] =
    dateString
      .split('-')
      .map(Number)

  const monthOffset =
    month - 1 + Number(months)

  const targetYear =
    year + Math.floor(monthOffset / 12)

  const targetMonth =
    ((monthOffset % 12) + 12) % 12

  const lastDayOfTargetMonth =
    new Date(
      targetYear,
      targetMonth + 1,
      0
    ).getDate()

  const targetDay =
    Math.min(
      day,
      lastDayOfTargetMonth
    )

  return [
    targetYear,
    String(targetMonth + 1)
      .padStart(2, '0'),
    String(targetDay)
      .padStart(2, '0'),
  ].join('-')
}

function getMaintenanceNextDate(task) {
  if (
    !task.lastServiceDate ||
    !task.intervalMonths
  ) {
    return null
  }

  return addMonthsToDateString(
    task.lastServiceDate,
    task.intervalMonths
  )
}

function getDaysUntilDate(dateString) {
  if (!dateString) {
    return null
  }

  const targetParts =
    dateString
      .split('-')
      .map(Number)

  const todayParts =
    getTodayDate()
      .split('-')
      .map(Number)

  const targetUtc = Date.UTC(
    targetParts[0],
    targetParts[1] - 1,
    targetParts[2]
  )

  const todayUtc = Date.UTC(
    todayParts[0],
    todayParts[1] - 1,
    todayParts[2]
  )

  return Math.round(
    (targetUtc - todayUtc) /
      (1000 * 60 * 60 * 24)
  )
}

function formatMaintenanceDateRemaining(
  task
) {
  const nextDate =
    getMaintenanceNextDate(task)

  if (!nextDate) {
    return ''
  }

  const days =
    getDaysUntilDate(nextDate)

  if (days == null) {
    return ''
  }

  if (days === 0) {
    return 'Сегодня'
  }

  const overdue = days < 0
  const absoluteDays = Math.abs(days)

  if (absoluteDays < 60) {
    return overdue
      ? `Просрочено на ${absoluteDays} дн.`
      : `через ${absoluteDays} дн.`
  }

  const months =
    Math.max(
      1,
      Math.round(
        absoluteDays / 30.44
      )
    )

  if (months < 24) {
    return overdue
      ? `Просрочено на ${months} мес.`
      : `через ${months} мес.`
  }

  const years =
    Math.floor(months / 12)

  const remainingMonths =
    months % 12

  const period =
    remainingMonths
      ? `${years} г. ${remainingMonths} мес.`
      : `${years} г.`

  return overdue
    ? `Просрочено на ${period}`
    : `через ${period}`
}

function getMaintenanceDateStatus(task) {
  const nextDate =
    getMaintenanceNextDate(task)

  const days =
    getDaysUntilDate(nextDate)

  if (days == null) {
    return ''
  }

  if (days <= 0) {
    return 'overdue'
  }

  if (days <= 30) {
    return 'soon'
  }

  return 'normal'
}

function getMaintenanceStatus(task) {
  const nextMileage =
    getMaintenanceNextMileage(task)

  const currentMileage =
    Number(getLastMileage())

  const remainingKm =
    nextMileage &&
    currentMileage
      ? nextMileage - currentMileage
      : null

  const nextDate =
    getMaintenanceNextDate(task)

  const remainingDays =
    nextDate
      ? getDaysUntilDate(nextDate)
      : null

  const mileageOverdue =
    remainingKm !== null &&
    remainingKm <= 0

  const dateOverdue =
    remainingDays !== null &&
    remainingDays <= 0

  if (
    mileageOverdue ||
    dateOverdue
  ) {
    return 'overdue'
  }

  const mileageSoon =
    remainingKm !== null &&
    remainingKm <= 500

  const dateSoon =
    remainingDays !== null &&
    remainingDays <= 30

  if (
    mileageSoon ||
    dateSoon
  ) {
    return 'soon'
  }

  return 'normal'
}

function isMaintenanceOverdue(task) {
  return (
    getMaintenanceStatus(task) ===
    'overdue'
  )
}

function getMaintenanceStatusLabel(task) {
  const status =
    getMaintenanceStatus(task)

  if (status === 'overdue') {
    return 'Просрочено'
  }

  if (status === 'soon') {
    return 'Скоро'
  }

  return ''
}

function formatMaintenanceMileageRemaining(
  task
) {
  const nextMileage =
    getMaintenanceNextMileage(task)

  const currentMileage =
    Number(getLastMileage())

  if (
    !nextMileage ||
    !currentMileage
  ) {
    return ''
  }

  const remaining =
    nextMileage - currentMileage

  if (remaining < 0) {
    return `Просрочено на ${Math.abs(
      remaining
    ).toLocaleString('lt-LT')} км`
  }

  if (remaining === 0) {
    return 'Пора выполнять'
  }

  return `Осталось ${remaining.toLocaleString(
    'lt-LT'
  )} км`
}

const sortedInstalledParts = useMemo(() => {
  const searchQuery =
    installedPartSearch
      .trim()
      .toLowerCase()

  return installedParts
    .filter((part) => {
      const matchesCategory =
        installedPartCategory === 'Все' ||
        part.category === installedPartCategory

      const searchableText = [
        part.name,
        part.category,
        part.manufacturer,
        part.article,
        part.oem,
        part.note,
      ]
        .map((value) =>
          String(value || '').toLowerCase()
        )
        .join(' ')

      const matchesSearch =
        !searchQuery ||
        searchableText.includes(searchQuery)

      return (
        matchesCategory &&
        matchesSearch
      )
    })
    .sort(compareInstalledParts)
}, [
  installedParts,
  installedPartSort,
  installedPartCategory,
  installedPartSearch,
  expenses,
])

function resetForm() {
  setForm({
    date: getTodayDate(),
    category: 'Запчасти',
    description: '',
    mileage: getLastMileage(),
        fuelVolume: '',
          fullTank: false,
    amount: '',
  })
}

function handleOpenAddForm() {
  setEditingExpenseId(null)
  resetForm()
  setShowForm(true)
}

function handleEditExpense(expense) {
  setEditingExpenseId(expense.id)

  setForm({
  date: expense.date,
  category: expense.category,
  description: expense.description,
  mileage: expense.mileage ?? '',
  fuelVolume: expense.fuelVolume ?? '',
    fullTank: expense.fullTank ?? false,
  amount: expense.amount,
})

  setShowForm(true)

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

function handleOpenAddPart() {
  setEditingPartId(null)
setNewPartPhotos([])
  setPartForm({
    name: '',
    category: installedPartCategories[0],
    quantity: 1,
    unit: 'шт.',
    installedDate: getTodayDate(),
    mileage: getLastMileage(),
      serviceLifeKm: '',
        replacementMileage: '',
    manufacturer: '',
    article: '',
    oem: '',
    note: '',
  })

  setShowPartForm(true)
}

async function handleDeleteInstalledPartPhoto(photo) {
  const confirmed = window.confirm(
    'Удалить это фото?'
  )

  if (!confirmed) {
    return
  }

  try {
    await deleteInstalledPartPhoto(photo)

    const updatedParts =
      await refreshInstalledParts()

    const updatedPart =
      updatedParts.find(
        (part) =>
          part.id === selectedInstalledPart.id
      )

    if (updatedPart) {
      setSelectedInstalledPart(updatedPart)
    }
  } catch (error) {
    console.error(
      'Ошибка удаления фото:',
      error
    )

    window.alert(
      'Не удалось удалить фото.'
    )
  }
}

function handleEditInstalledPart(part) {
  setEditingPartId(part.id)
  setNewPartPhotos([])

  setPartForm({
    name: part.name || '',
    category:
  part.category || installedPartCategories[0],
    quantity: part.quantity || 1,
    unit: part.unit || 'шт.',
    installedDate:
      part.installedDate || getTodayDate(),
    mileage: part.mileage ?? '',
    serviceLifeKm: part.serviceLifeKm ?? '',
    replacementMileage: part.replacementMileage ?? '',
    manufacturer: part.manufacturer || '',
    article: part.article || '',
    oem: part.oem || '',
    note: part.note || '',
  })

  setShowPartForm(true)

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

async function handleDeleteInstalledPart(part) {
  const confirmed = window.confirm(
    `Удалить установленную деталь "${part.name}"?`
  )

  if (!confirmed) {
    return
  }

  try {
    await deleteInstalledPart(part.id)

    for (const photo of part.photos || []) {
      try {
        await deleteInstalledPartPhoto(photo)
      } catch (photoError) {
        console.warn(
          'Не удалось удалить фото детали:',
          photoError
        )
      }
    }

    await refreshInstalledParts()
    await refreshMaintenanceTasks()

    setSelectedInstalledPart(null)
    setEditingPartId(null)
    setShowPartForm(false)
  } catch (error) {
    console.error(
      'Ошибка удаления установленной детали:',
      error
    )

    window.alert(
      'Не удалось удалить установленную деталь.'
    )
  }
}

function handlePartChange(event) {
  const { name, value } = event.target

  setPartForm((current) => ({
    ...current,
    [name]: value,
  }))
}

function handleCancelPartForm() {
  setEditingPartId(null)
  setShowPartForm(false)
}

async function handlePartSubmit(event) {
  event.preventDefault()
if (!selectedCarId) {
  window.alert(
    'Автомобиль не выбран.'
  )
  return
}
  if (!partForm.name.trim()) {
    return
  }

  try {
const partId = await saveInstalledPart({
  id: editingPartId || undefined,
    carId: selectedCarId,
  name: partForm.name.trim(),
  category: partForm.category,
  quantity: Number(partForm.quantity) || 1,
  unit: partForm.unit,
  installedDate: partForm.installedDate,
  mileage:
    partForm.mileage === ''
      ? null
      : Number(partForm.mileage),
      serviceLifeKm:
  partForm.serviceLifeKm === ''
    ? null
    : Number(partForm.serviceLifeKm),
    replacementMileage:
  partForm.replacementMileage === ''
    ? null
    : Number(partForm.replacementMileage),
  manufacturer: partForm.manufacturer.trim(),
  article: partForm.article.trim(),
  oem: partForm.oem.trim(),
  note: partForm.note.trim(),
})

if (newPartPhotos.length > 0) {
  const existingPart = editingPartId
    ? installedParts.find(
        (part) => part.id === editingPartId
      )
    : null

  const currentPhotoCount =
    existingPart?.photos?.length || 0

  await uploadInstalledPartPhotos(
    partId,
    newPartPhotos,
    currentPhotoCount
  )
}

const updatedParts = await refreshInstalledParts()

if (editingPartId) {
  const updatedPart = updatedParts.find(
    (part) => part.id === editingPartId
  )

  if (updatedPart) {
    setSelectedInstalledPart(updatedPart)
  }
}

setEditingPartId(null)
setNewPartPhotos([])
setShowPartForm(false)
  } catch (error) {
    console.error(
      'Ошибка сохранения установленной детали:',
      error
    )

    window.alert(
      'Не удалось сохранить установленную деталь.'
    )
  }
}

function handleOpenAddMaintenance() {
  setEditingMaintenanceId(null)

setMaintenanceForm({
  name: '',
  lastServiceDate: getTodayDate(),
  lastServiceMileage: getLastMileage(),
  intervalKm: '',
  nextServiceMileage: '',
  installedPartId: '',
  note: '',
})

  setShowMaintenanceForm(true)
}

function handleEditMaintenance(task) {
  setEditingMaintenanceId(task.id)

setMaintenanceForm({
  name: task.name || '',
  lastServiceDate: task.lastServiceDate || '',
  lastServiceMileage: task.lastServiceMileage ?? '',
  intervalKm: task.intervalKm ?? '',
  intervalMonths: task.intervalMonths ?? '',
  nextServiceMileage: task.nextServiceMileage ?? '',
  installedPartId: task.installedPartId || '',
  note: task.note || '',
})

  setShowMaintenanceForm(true)

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

async function handleDeleteMaintenance(task) {
  const confirmed = window.confirm(
    `Удалить регламентную работу "${task.name}"?`
  )

  if (!confirmed) {
    return
  }

  try {
    await deleteMaintenanceTask(task.id)
    await refreshMaintenanceTasks()
  } catch (error) {
    console.error(
      'Ошибка удаления регламентной работы:',
      error
    )

    window.alert(
      'Не удалось удалить регламентную работу.'
    )
  }
}

function handleMaintenanceChange(event) {
  const { name, value } = event.target

  setMaintenanceForm((current) => ({
    ...current,
    [name]: value,
  }))
}

function handleCancelMaintenanceForm() {
  setEditingMaintenanceId(null)
  setShowMaintenanceForm(false)
}

async function handleMaintenanceSubmit(event) {
  event.preventDefault()
if (!selectedCarId) {
  window.alert(
    'Автомобиль не выбран.'
  )
  return
}
  if (maintenanceSaving) {
    return
  }

  if (!maintenanceForm.name.trim()) {
    return
  }

  setMaintenanceSaving(true)

  try {

    await saveMaintenanceTask({
      id: editingMaintenanceId || undefined,
      carId: selectedCarId,
      name: maintenanceForm.name.trim(),

      lastServiceDate:
        maintenanceForm.lastServiceDate || null,

      lastServiceMileage:
        maintenanceForm.lastServiceMileage === ''
          ? null
          : Number(maintenanceForm.lastServiceMileage),

intervalKm:
  maintenanceForm.intervalKm === ''
    ? null
    : Number(maintenanceForm.intervalKm),

intervalMonths:
  maintenanceForm.intervalMonths === ''
    ? null
    : Number(maintenanceForm.intervalMonths),

nextServiceMileage:
  maintenanceForm.nextServiceMileage === ''
    ? null
    : Number(maintenanceForm.nextServiceMileage),

      installedPartId:
        maintenanceForm.installedPartId || null,

      note: maintenanceForm.note.trim(),
    })

    await refreshMaintenanceTasks()

    setEditingMaintenanceId(null)
    setShowMaintenanceForm(false)
  } catch (error) {
    console.error(
      'Ошибка сохранения регламентной работы:',
      error
    )

    window.alert(
      'Не удалось сохранить регламентную работу.'
    )
  } finally {
    setMaintenanceSaving(false)
  }
}

async function handleAddCurrentWork(event) {
  event.preventDefault()
if (!selectedCarId) {
  window.alert(
    'Автомобиль не выбран.'
  )
  return
}
  const text = currentWorkText.trim()

  if (!text) {
    return
  }

  try {
await addCurrentWork(
  text,
  currentWorkPriority,
  selectedCarId
)
    await refreshCurrentWorks()

    setCurrentWorkText('')
    setCurrentWorkPriority('medium')
  } catch (error) {
    console.error(
      'Ошибка добавления текущей работы:',
      error
    )
  }
}

async function handleChangeCurrentWorkPriority(item) {
 const priorityCycle = {
  high: 'medium',
  medium: 'low',
  low: 'buy',
  buy: 'high',
}

  const nextPriority =
    priorityCycle[item.priority] || 'medium'

  try {
    await updateCurrentWorkPriority(
      item.id,
      nextPriority
    )

    setCurrentWorks((current) =>
      current.map((work) =>
        work.id === item.id
          ? {
              ...work,
              priority: nextPriority,
            }
          : work
      )
    )
  } catch (error) {
    console.error(
      'Ошибка изменения приоритета:',
      error
    )
  }
}

async function handleDeleteCurrentWork(item) {
  try {
    await deleteCurrentWork(item.id)
    await refreshCurrentWorks()
  } catch (error) {
    console.error(
      'Ошибка удаления текущей работы:',
      error
    )
  }
}
async function handleAddPurchaseItem(event) {
  event.preventDefault()
if (!selectedCarId) {
  window.alert(
    'Автомобиль не выбран.'
  )
  return
}
  const text = purchaseText.trim()

  if (!text) {
    return
  }

  try {
await addPurchaseItem(
  text,
  purchasePriority,
  selectedCarId
)

    await refreshPurchaseItems()

    setPurchaseText('')
    setPurchasePriority('medium')
  } catch (error) {
    console.error(
      'Ошибка добавления покупки:',
      error
    )
  }
}

async function handleChangePurchasePriority(item) {
  const priorityCycle = {
    high: 'medium',
    medium: 'low',
    low: 'high',
  }

  const nextPriority =
    priorityCycle[item.priority] || 'medium'

  try {
    await updatePurchaseItemPriority(
      item.id,
      nextPriority
    )

    setPurchaseItems((current) =>
      current.map((purchase) =>
        purchase.id === item.id
          ? {
              ...purchase,
              priority: nextPriority,
            }
          : purchase
      )
    )
  } catch (error) {
    console.error(
      'Ошибка изменения приоритета покупки:',
      error
    )
  }
}

async function handleDeletePurchaseItem(item) {
  try {
    await deletePurchaseItem(item.id)
    await refreshPurchaseItems()
  } catch (error) {
    console.error(
      'Ошибка удаления покупки:',
      error
    )
  }
}

async function handleSubmit(event) {
  event.preventDefault()
if (!selectedCarId) {
  window.alert(
    'Автомобиль не выбран.'
  )
  return
}
  const amount = Number(form.amount)

const fuelVolume =
  form.category === 'Топливо'
    ? Number(form.fuelVolume)
    : null

 if (!form.date || amount <= 0) {
  return
}

if (
  form.category === 'Топливо' &&
  (!fuelVolume || fuelVolume <= 0)
) {
  window.alert(
    'Для категории «Топливо» укажите объём топлива.'
  )

  return
}

const expenseData = {
  carId: selectedCarId,
  date: form.date,
    category: form.category,
    description: form.description.trim(),
    mileage:
      form.mileage === ''
        ? null
        : Number(form.mileage),
        fuelVolume,

        fullTank:
  form.category === 'Топливо'
    ? form.fullTank
    : false,

    amount,
  }

  try {
    if (editingExpenseId) {
      await saveExpense({
        id: editingExpenseId,
        ...expenseData,
      })
    } else {
      await saveExpense(expenseData)
    }

    await refreshExpenses()

    resetForm()
    setEditingExpenseId(null)
    setShowForm(false)
  } catch (error) {
    console.error('Ошибка сохранения расхода:', error)

    window.alert(
      'Не удалось сохранить расход. Попробуйте ещё раз.'
    )
  }
}
async function handleDeleteExpense(expense) {
  const confirmed = window.confirm(
    `Удалить расход "${expense.description}" на ${formatMoney(expense.amount)}?`
  )

  if (!confirmed) {
    return
  }

  try {
    await deleteExpense(expense.id)
    await refreshExpenses()
  } catch (error) {
    console.error('Ошибка удаления расхода:', error)

    window.alert(
      'Не удалось удалить расход. Попробуйте ещё раз.'
    )
  }
}

function resetNoteForm() {
  setNoteForm({
    title: '',
    content: '',
  })
}

function handleOpenAddNote() {
  setEditingNoteId(null)
  resetNoteForm()
  setShowNoteForm(true)
}

function handleEditCarNote(note) {
  setEditingNoteId(note.id)

  setNoteForm({
    title: note.title || '',
    content: note.content || '',
  })

  setShowNoteForm(true)

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

function handleNoteChange(event) {
  const { name, value } =
    event.target

  setNoteForm((current) => ({
    ...current,
    [name]: value,
  }))
}

function handleCancelNoteForm() {
  setEditingNoteId(null)
  resetNoteForm()
  setShowNoteForm(false)
}

async function handleNoteSubmit(event) {
  event.preventDefault()
if (!selectedCarId) {
  window.alert(
    'Автомобиль не выбран.'
  )
  return
}
  if (
    !noteForm.title.trim() ||
    !noteForm.content.trim()
  ) {
    return
  }

  try {
    await saveCarNote({
      id:
        editingNoteId ||
        undefined,
carId: selectedCarId,
      title:
        noteForm.title,

      content:
        noteForm.content,
    })

    await refreshCarNotes()

    setEditingNoteId(null)
    resetNoteForm()
    setShowNoteForm(false)
  } catch (error) {
    console.error(
      'Ошибка сохранения заметки:',
      error
    )

    window.alert(
      'Не удалось сохранить заметку.'
    )
  }
}

async function handleDeleteCarNote(note) {
  const confirmed =
    window.confirm(
      `Удалить заметку "${note.title}"?`
    )

  if (!confirmed) {
    return
  }

  try {
    await deleteCarNote(note.id)

    await refreshCarNotes()
  } catch (error) {
    console.error(
      'Ошибка удаления заметки:',
      error
    )

    window.alert(
      'Не удалось удалить заметку.'
    )
  }
}

if (authLoading) {
  return (
    <main className="app">
      <p>Проверка входа...</p>
    </main>
  )
}

if (!session) {
  return <AuthScreen />
}

if (carsLoading) {
  return (
    <main className="app">
      <p>
        Загрузка автомобилей...
      </p>
    </main>
  )
}

if (expensesLoading) {
  return (
    <main className="app">
      <p>Загрузка расходов...</p>
    </main>
  )
}
  return (
    <main className="app">
      <header className="topbar">
        <div>
<div className="app-title-row">
<h1>Моя машина</h1>
<span className="app-version">v3.9.0</span>
</div>
</div>
<div className="header-selects">
  <div className="header-section-control">
    <select
      value={selectedCarId}
      onChange={(event) => {
        setSelectedCarId(
          event.target.value
        )
        setSelectedInstalledPart(
          null
        )
      }}
      disabled={
        carsLoading ||
        cars.length === 0
      }
      aria-label="Автомобиль"
    >
      {cars.map((car) => (
        <option
          key={car.id}
          value={car.id}
        >
          {car.name}
        </option>
      ))}
    </select>
  </div>

  <div className="header-section-control">
    <select
      value={citroenSection}
      onChange={(event) =>
        setCitroenSection(
          event.target.value
        )
      }
      aria-label="Раздел"
    >
      <option value="home">
        Главная
      </option>

      <option value="expenses">
        Расходы
      </option>

      <option value="parts">
        Установленные детали
      </option>

      <option value="maintenance">
        Регламентные работы
      </option>

      <option value="current">
        Текущие работы
      </option>

      <option value="buy">
        Купить
      </option>

      <option value="notes">
        Заметки
      </option>
    </select>
  </div>
</div>

<div className="header-actions">
  {citroenSection === 'expenses' && (
  <>
    <button
      className="primary-button"
      onClick={handleOpenAddForm}
    >
      + Добавить расход
    </button>

    <input
      ref={expenseImportInputRef}
      type="file"
      accept=".xlsx"
      hidden
      onChange={
        handleExpenseImport
      }
    />

    <button
      type="button"
      className="secondary-button"
      disabled={
        expenseImporting
      }
      onClick={() =>
        expenseImportInputRef
          .current
          ?.click()
      }
    >
      {expenseImporting
        ? 'Импорт...'
        : 'Импорт Excel'}
    </button>
  </>
)}

{citroenSection === 'parts' && (
  <button
    className="primary-button"
    onClick={handleOpenAddPart}
  >
    + Добавить деталь
  </button>
)}

  {citroenSection === 'maintenance' && (
    <button
      className="primary-button"
      onClick={handleOpenAddMaintenance}
    >
      + Добавить работу
    </button>
  )}

{citroenSection === 'notes' && (
  <button
    className="primary-button"
    onClick={handleOpenAddNote}
  >
    + Добавить заметку
  </button>
)}

  <button
    className="secondary-button"
    onClick={() => supabase.auth.signOut()}
  >
    Выйти
  </button>
</div>

      </header>

{citroenSection === 'home' && (
  <section className="home-dashboard">
    <div className="home-dashboard-header">
      <h2>
  {selectedCar
    ? `${selectedCar.name} — Главная`
    : 'Главная'}
</h2>

      <div className="home-dashboard-mileage">
        Текущий пробег:{' '}
        <strong>
          {getLastMileage()
            ? `${Number(
                getLastMileage()
              ).toLocaleString(
                'lt-LT'
              )} км`
            : '—'}
        </strong>
      </div>
    </div>

    <div className="home-dashboard-grid">
      {dashboardInstalledParts.length > 0 && (
        <section className="home-dashboard-card">
          <div className="home-dashboard-card-header">
            <h3>Детали к замене</h3>

            <span className="home-dashboard-count">
              {dashboardInstalledParts.length}
            </span>
          </div>

          <div className="home-dashboard-list">
            {dashboardInstalledParts.map(
              (part) => {
                const status =
                  getRemainingMileageStatus(
                    part
                  )

                return (
                  <button
                    key={part.id}
                    type="button"
                    className="home-dashboard-item"
                    onClick={() => {
                      setSelectedInstalledPart(
                        part
                      )

                      setCitroenSection(
                        'parts'
                      )
                    }}
                  >
                    <div className="home-dashboard-item-main">
                      <strong>
                        {part.name}
                      </strong>

                      <span
                        className={`home-dashboard-status ${status}`}
                      >
                        {status ===
                        'overdue'
                          ? 'Просрочено'
                          : 'Скоро'}
                      </span>
                    </div>

                    <div
                      className={`home-dashboard-item-info ${status}`}
                    >
                      {formatRemainingMileage(
                        part
                      )}
                    </div>
                  </button>
                )
              }
            )}
          </div>
        </section>
      )}

      {dashboardMaintenanceTasks.length > 0 && (
        <section className="home-dashboard-card">
          <div className="home-dashboard-card-header">
            <h3>
              Регламентные работы
            </h3>

            <span className="home-dashboard-count">
              {
                dashboardMaintenanceTasks.length
              }
            </span>
          </div>

          <div className="home-dashboard-list">
            {dashboardMaintenanceTasks.map(
              (task) => {
                const status =
                  getMaintenanceStatus(
                    task
                  )

                const nextMileage =
                  getMaintenanceNextMileage(
                    task
                  )

                const nextDate =
                  getMaintenanceNextDate(
                    task
                  )

                return (
                  <button
                    key={task.id}
                    type="button"
                    className="home-dashboard-item"
                    onClick={() =>
                      setCitroenSection(
                        'maintenance'
                      )
                    }
                  >
                    <div className="home-dashboard-item-main">
                      <strong>
                        {task.name}
                      </strong>

                      <span
                        className={`home-dashboard-status ${status}`}
                      >
                        {getMaintenanceStatusLabel(
                          task
                        )}
                      </span>
                    </div>

                    {nextMileage && (
                      <div
                        className={`home-dashboard-item-info ${status}`}
                      >
                        {formatMaintenanceMileageRemaining(
                          task
                        )}
                      </div>
                    )}

                    {nextDate && (
                      <div
                        className={`home-dashboard-item-info ${getMaintenanceDateStatus(
                          task
                        )}`}
                      >
                        {formatDate(
                          nextDate
                        )}
                        {' — '}
                        {formatMaintenanceDateRemaining(
                          task
                        )}
                      </div>
                    )}
                  </button>
                )
              }
            )}
          </div>
        </section>
      )}

      {dashboardCurrentWorks.length > 0 && (
        <section className="home-dashboard-card">
          <div className="home-dashboard-card-header">
            <h3>
              Текущие работы
            </h3>

            <span className="home-dashboard-count">
              {dashboardCurrentWorks.length}
            </span>
          </div>

          <div className="home-dashboard-list">
            {dashboardCurrentWorks.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className="home-dashboard-item"
                  onClick={() =>
                    setCitroenSection(
                      'current'
                    )
                  }
                >
                  <div className="home-dashboard-priority-item">
                    <span className="current-work-priority-dot high" />

                    <strong>
                      {item.text}
                    </strong>
                  </div>
                </button>
              )
            )}
          </div>
        </section>
      )}

      {dashboardPurchaseItems.length > 0 && (
        <section className="home-dashboard-card">
          <div className="home-dashboard-card-header">
            <h3>Купить</h3>

            <span className="home-dashboard-count">
              {dashboardPurchaseItems.length}
            </span>
          </div>

          <div className="home-dashboard-list">
            {dashboardPurchaseItems.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className="home-dashboard-item"
                  onClick={() =>
                    setCitroenSection(
                      'buy'
                    )
                  }
                >
                  <div className="home-dashboard-priority-item">
                    <span className="current-work-priority-dot high" />

                    <strong>
                      {item.text}
                    </strong>
                  </div>
                </button>
              )
            )}
          </div>
        </section>
      )}
    </div>
  </section>
)}

      {showForm && (
        <section className="expense-form-section">
          <div className="section-header">
            <h2>
  {editingExpenseId ? 'Редактировать расход' : 'Новый расход'}
</h2>
          </div>

          <form
            className="expense-form"
            onSubmit={handleSubmit}
          >
            <label>
              <span>Дата</span>

              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Категория</span>

              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
{carCategories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </label>

            {form.category !== 'Топливо' && (

  <label className="description-field">
    <span>Описание</span>

    <input
      type="text"
      name="description"
      value={form.description}
      onChange={handleChange}
      placeholder="Например: моторное масло"
    />
  </label>
)}

<label>
  <span>Пробег, км</span>

  <input
    type="number"
    name="mileage"
    value={form.mileage}
    onChange={handleChange}
    min="0"
  />
</label>

{form.category === 'Топливо' && (
  <label>
    <span>Объём, л</span>

    <input
      type="number"
      name="fuelVolume"
      value={form.fuelVolume}
      onChange={handleChange}
      min="0.01"
      step="0.01"
      placeholder="Например: 42.50"
      required
    />
  </label>
)}

{form.category === 'Топливо' && (
  <label className="fuel-full-tank-field">
    <input
      type="checkbox"
      name="fullTank"
      checked={form.fullTank}
      onChange={handleChange}
    />

    <span>Полный бак</span>
  </label>
)}

<label>
  <span>Сумма, €</span>

              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
  resetForm()
  setEditingExpenseId(null)
  setShowForm(false)
}}
              >
                Отмена
              </button>

              <button
                type="submit"
                className="primary-button"
              >
                {editingExpenseId ? 'Сохранить изменения' : 'Сохранить'}
              </button>
            </div>
          </form>
        </section>
      )}

{citroenSection === 'parts' &&
  showPartForm && (
    <section className="expense-form-section">
      <div className="section-header">
        <h2>
          {editingPartId
            ? 'Редактировать установленную деталь'
            : 'Добавить установленную деталь'}
        </h2>
      </div>

      <form
        className="installed-part-form"
        onSubmit={handlePartSubmit}
      >
        <label>
          <span>Название детали</span>
          <input
            type="text"
            name="name"
            value={partForm.name}
            onChange={handlePartChange}
            required
          />
        </label>
<label>
  <span>Категория</span>

  <select
    name="category"
    value={partForm.category}
    onChange={handlePartChange}
    required
  >
    {installedPartCategories.map(
      (category) => (
        <option
          key={category}
          value={category}
        >
          {category}
        </option>
      )
    )}
  </select>
</label>

<label>
  <span>Количество</span>

  <input
    type="number"
    name="quantity"
    value={partForm.quantity}
    onChange={handlePartChange}
    min="0.001"
    step="0.001"
    required
  />
</label>

<label>
  <span>Единица</span>

  <select
    name="unit"
    value={partForm.unit}
    onChange={handlePartChange}
  >
    <option value="шт.">шт.</option>
    <option value="л">л</option>
    <option value="мл">мл</option>
    <option value="компл.">компл.</option>
    <option value="м">м</option>
    <option value="г">г</option>
    <option value="кг">кг</option>
  </select>
</label>

        <label>
          <span>Дата установки</span>
          <input
            type="date"
            name="installedDate"
            value={partForm.installedDate}
            onChange={handlePartChange}
            required
          />
        </label>

        <label>
          <span>Пробег, км</span>
          <input
            type="number"
            name="mileage"
            value={partForm.mileage}
            onChange={handlePartChange}
            min="0"
          />
        </label>

<label>
  <span>Ресурс, км</span>
  <input
    type="number"
    name="serviceLifeKm"
    value={partForm.serviceLifeKm}
    onChange={handlePartChange}
    min="1"
    placeholder="Например: 60000"
  />
</label>

<label>
  <span>Следующая замена, км</span>
  <input
    type="number"
    name="replacementMileage"
    value={partForm.replacementMileage}
    onChange={handlePartChange}
    min="1"
    placeholder="Например: 300000"
  />
</label>

        <label>
          <span>Производитель</span>
          <input
            type="text"
            name="manufacturer"
            value={partForm.manufacturer}
            onChange={handlePartChange}
          />
        </label>

        <label>
          <span>Артикул</span>
          <input
            type="text"
            name="article"
            value={partForm.article}
            onChange={handlePartChange}
          />
        </label>

        <label>
          <span>OEM</span>
          <input
            type="text"
            name="oem"
            value={partForm.oem}
            onChange={handlePartChange}
          />
        </label>

        <label className="part-note-field">
          <span>Примечание</span>
          <textarea
            name="note"
            value={partForm.note}
            onChange={handlePartChange}
            rows="3"
          />
        </label>

        <label className="part-photo-field">
          <span>Фотографии (до 5)</span>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(
                event.target.files || []
              ).slice(0, 5)

              setNewPartPhotos(files)
            }}
          />

          {newPartPhotos.length > 0 && (
            <div className="new-photo-previews">
              {newPartPhotos.map((file, index) => (
                <div
                  className="new-photo-preview"
                  key={`${file.name}-${index}`}
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                  />

                  <span>{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </label>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleCancelPartForm}
          >
            Отмена
          </button>

          <button
  type="submit"
  className="primary-button"
  disabled={maintenanceSaving}
>
  {maintenanceSaving
    ? 'Сохранение...'
    : 'Сохранить'}
</button>

        </div>
      </form>
    </section>
  )}

{citroenSection === 'parts' && (
  <div
    className={`installed-parts-layout ${
      selectedInstalledPart
        ? 'has-selection'
        : ''
    }`}
  >
    <section className="expenses-section installed-parts-list-panel">
      <div className="section-header installed-parts-list-header">
        <h2>Установленные детали</h2>
      </div>

      <div className="installed-parts-filters">
        <input
          type="search"
          value={installedPartSearch}
          onChange={(event) =>
            setInstalledPartSearch(
              event.target.value
            )
          }
          placeholder="Поиск деталей..."
        />

        <select
          value={installedPartCategory}
          onChange={(event) =>
            setInstalledPartCategory(
              event.target.value
            )
          }
        >
          <option value="Все">
            Все категории
          </option>

          {installedPartCategories.map(
            (category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            )
          )}
        </select>
      </div>

      {installedPartsLoading ? (
        <p style={{ padding: '20px' }}>
          Загрузка деталей...
        </p>
      ) : (
        <>
          <div className="table-wrapper installed-parts-desktop">
            <table>
              <thead>
                <tr>
  <th>
    <button
      type="button"
      className="table-sort-button"
      onClick={() =>
        handleInstalledPartSort(
          'date'
        )
      }
    >
      Дата
      <span className="sort-arrow">
        {getInstalledPartSortArrow(
          'date'
        )}
      </span>
    </button>
  </th>

  <th>
    <button
      type="button"
      className="table-sort-button"
      onClick={() =>
        handleInstalledPartSort(
          'name'
        )
      }
    >
      Деталь
      <span className="sort-arrow">
        {getInstalledPartSortArrow(
          'name'
        )}
      </span>
    </button>
  </th>

  <th>
    <button
      type="button"
      className="table-sort-button"
      onClick={() =>
        handleInstalledPartSort(
          'installed'
        )
      }
    >
      Установлено
      <span className="sort-arrow">
        {getInstalledPartSortArrow(
          'installed'
        )}
      </span>
    </button>
  </th>

  <th>
    <button
      type="button"
      className="table-sort-button"
      onClick={() =>
        handleInstalledPartSort(
          'wear'
        )
      }
    >
      Износ
      <span className="sort-arrow">
        {getInstalledPartSortArrow(
          'wear'
        )}
      </span>
    </button>
  </th>

  <th>
    <button
      type="button"
      className="table-sort-button"
      onClick={() =>
        handleInstalledPartSort(
          'resource'
        )
      }
    >
      Ресурс
      <span className="sort-arrow">
        {getInstalledPartSortArrow(
          'resource'
        )}
      </span>
    </button>
  </th>

  <th>
    <button
      type="button"
      className="table-sort-button"
      onClick={() =>
        handleInstalledPartSort(
          'replacement'
        )
      }
    >
      Замена
      <span className="sort-arrow">
        {getInstalledPartSortArrow(
          'replacement'
        )}
      </span>
    </button>
  </th>

  <th>
    <button
      type="button"
      className="table-sort-button"
      onClick={() =>
        handleInstalledPartSort(
          'remaining'
        )
      }
    >
      Осталось
      <span className="sort-arrow">
        {getInstalledPartSortArrow(
          'remaining'
        )}
      </span>
    </button>
  </th>
</tr>
              </thead>

              <tbody>
                {sortedInstalledParts.map(
                  (part) => {
                    const replacementMileage =
                      getReplacementMileage(part)

                    const remainingStatus =
                      getRemainingMileageStatus(
                        part
                      )

                    return (
                      <tr
                        key={part.id}
                        className="installed-part-row"
                        onClick={() =>
                          setSelectedInstalledPart(
                            part
                          )
                        }
                      >
                        <td>
                          {formatDate(
                            part.installedDate
                          )}
                        </td>

                        <td className="installed-part-name-cell">
                          {part.name}
                        </td>

                  

                        <td>
                          {part.mileage != null
                            ? `${Number(
                                part.mileage
                              ).toLocaleString(
                                'lt-LT'
                              )} км`
                            : '—'}
                        </td>

<td>
  {getPartWearMileage(part) !== null
    ? `${getPartWearMileage(
        part
      ).toLocaleString(
        'lt-LT'
      )} км`
    : '—'}
</td>

                        <td>
                          {part.serviceLifeKm
                            ? `${Number(
                                part.serviceLifeKm
                              ).toLocaleString(
                                'lt-LT'
                              )} км`
                            : '—'}
                        </td>

                        <td>
                          {replacementMileage != null
                            ? `${Number(
                                replacementMileage
                              ).toLocaleString(
                                'lt-LT'
                              )} км`
                            : '—'}
                        </td>

                        <td
                          className={`remaining-mileage ${remainingStatus}`}
                        >
                          {formatRemainingMileage(
                            part
                          )}
                        </td>
                      </tr>
                    )
                  }
                )}

                {sortedInstalledParts.length ===
                  0 && (
                  <tr>
                    <td colSpan="7">
                      {installedParts.length === 0
                        ? 'Установленных деталей пока нет.'
                        : 'Подходящих деталей не найдено.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="installed-parts-mobile">
            {sortedInstalledParts.map(
              (part) => {
                const replacementMileage =
                  getReplacementMileage(part)

                const remainingStatus =
                  getRemainingMileageStatus(
                    part
                  )

                return (
                  <button
                    key={part.id}
                    type="button"
                    className="installed-part-mobile-card"
                    onClick={() =>
                      setSelectedInstalledPart(
                        part
                      )
                    }
                  >
                    <strong className="installed-part-mobile-name">
                      {part.name}
                    </strong>

                    <div className="installed-part-mobile-meta">
                      <span>
                        {formatDate(
                          part.installedDate
                        )}
                      </span>

                      {part.mileage != null && (
                        <>
                          <span>•</span>

                          <span>
                            {Number(
                              part.mileage
                            ).toLocaleString(
                              'lt-LT'
                            )}{' '}
                            км
                          </span>
                        </>
                      )}

                      <span>•</span>

                      <span>
                        {formatPartQuantity(
                          part
                        )}
                      </span>
                    </div>

                    <div className="installed-part-mobile-service">
                      <div>
                        <span>Ресурс</span>
                        <strong>
                          {part.serviceLifeKm
                            ? `${Number(
                                part.serviceLifeKm
                              ).toLocaleString(
                                'lt-LT'
                              )} км`
                            : '—'}
                        </strong>
                      </div>

                      <div>
                        <span>Замена</span>
                        <strong>
                          {replacementMileage != null
                            ? `${Number(
                                replacementMileage
                              ).toLocaleString(
                                'lt-LT'
                              )} км`
                            : '—'}
                        </strong>
                      </div>
                    </div>

                    <div
                      className={`installed-part-mobile-remaining ${remainingStatus}`}
                    >
                      {remainingStatus ===
                      'overdue'
                        ? ''
                        : 'Осталось: '}

                      {formatRemainingMileage(
                        part
                      )}
                    </div>
                  </button>
                )
              }
            )}

            {sortedInstalledParts.length ===
              0 && (
              <p className="installed-parts-empty">
                Подходящих деталей не найдено.
              </p>
            )}
          </div>
        </>
      )}
    </section>

    {selectedInstalledPart && (
      <section className="part-detail installed-part-detail-panel">
        <div className="detail-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setSelectedInstalledPart(null)
            }
          >
            ← Назад
          </button>

          <button
            type="button"
            className="edit-button"
            onClick={() =>
              handleEditInstalledPart(
                selectedInstalledPart
              )
            }
          >
            Редактировать
          </button>

          <button
            type="button"
            className="delete-button"
            onClick={() =>
              handleDeleteInstalledPart(
                selectedInstalledPart
              )
            }
          >
            Удалить
          </button>
        </div>

        <h2>
          {selectedInstalledPart.name}
        </h2>

        {selectedInstalledPart.photos
          ?.length > 0 && (
          <div className="installed-part-photos">
            {selectedInstalledPart.photos.map(
              (photo) => (
                <InstalledPartPhoto
                  key={photo.id}
                  photo={photo}
                  alt={
                    selectedInstalledPart.name
                  }
                  onOpen={
                    setOpenedPartPhoto
                  }
                  onDelete={
                    handleDeleteInstalledPartPhoto
                  }
                />
              )
            )}
          </div>
        )}

        <div className="part-detail-fields">
          <p>
            <strong>Категория:</strong>{' '}
            {selectedInstalledPart.category ||
              '—'}
          </p>

          <p>
            <strong>Количество:</strong>{' '}
            {formatPartQuantity(
              selectedInstalledPart
            )}
          </p>

          <p>
            <strong>
              Дата установки:
            </strong>{' '}
            {formatDate(
              selectedInstalledPart.installedDate
            )}
          </p>

          <p>
            <strong>
              Пробег установки:
            </strong>{' '}
            {selectedInstalledPart.mileage != null
              ? `${Number(
                  selectedInstalledPart.mileage
                ).toLocaleString(
                  'lt-LT'
                )} км`
              : '—'}
          </p>
<p>
  <strong>Износ:</strong>{' '}

  {getPartWearMileage(
    selectedInstalledPart
  ) !== null
    ? `${getPartWearMileage(
        selectedInstalledPart
      ).toLocaleString(
        'lt-LT'
      )} км`
    : '—'}
</p>

          <p>
            <strong>Ресурс:</strong>{' '}
            {selectedInstalledPart.serviceLifeKm
              ? `${Number(
                  selectedInstalledPart.serviceLifeKm
                ).toLocaleString(
                  'lt-LT'
                )} км`
              : '—'}
          </p>

          <p>
            <strong>
              Следующая замена:
            </strong>{' '}
            {getReplacementMileage(
              selectedInstalledPart
            ) != null
              ? `${getReplacementMileage(
                  selectedInstalledPart
                ).toLocaleString(
                  'lt-LT'
                )} км`
              : '—'}
          </p>

          <p
            className={`part-remaining ${getRemainingMileageStatus(
              selectedInstalledPart
            )}`}
          >
            <strong>До замены:</strong>{' '}
            {formatRemainingMileage(
              selectedInstalledPart
            )}
          </p>

          <p>
            <strong>
              Производитель:
            </strong>{' '}
            {selectedInstalledPart.manufacturer ||
              '—'}
          </p>

          <p>
            <strong>Артикул:</strong>{' '}
            {selectedInstalledPart.article ||
              '—'}
          </p>

          <p>
            <strong>OEM:</strong>{' '}
            {selectedInstalledPart.oem ||
              '—'}
          </p>
        </div>

        {selectedInstalledPart.note && (
          <div className="part-note">
            <strong>Примечание</strong>
            <p>
              {selectedInstalledPart.note}
            </p>
          </div>
        )}
      </section>
    )}
  </div>
)}

{citroenSection === 'maintenance' &&
  showMaintenanceForm && (
    <section className="expense-form-section">
      <div className="section-header">
        <h2>
          {editingMaintenanceId
            ? 'Редактировать работу'
            : 'Добавить регламентную работу'}
        </h2>
      </div>

      <form
        className="installed-part-form"
        onSubmit={handleMaintenanceSubmit}
      >
        <label>
          <span>Работа</span>
          <input
            type="text"
            name="name"
            value={maintenanceForm.name}
            onChange={handleMaintenanceChange}
            placeholder="Например: Замена моторного масла"
            required
          />
        </label>

        <label>
          <span>Дата выполнения</span>
          <input
            type="date"
            name="lastServiceDate"
            value={maintenanceForm.lastServiceDate}
            onChange={handleMaintenanceChange}
          />
        </label>

        <label>
          <span>Пробег выполнения, км</span>
          <input
            type="number"
            name="lastServiceMileage"
            value={maintenanceForm.lastServiceMileage}
            onChange={handleMaintenanceChange}
            min="0"
          />
        </label>

        <label>
          <span>Интервал, км</span>
          <input
            type="number"
            name="intervalKm"
            value={maintenanceForm.intervalKm}
            onChange={handleMaintenanceChange}
            min="1"
            placeholder="Например: 10000"
          />
        </label>

<label>
  <span>Интервал по времени, мес.</span>

  <input
    type="number"
    name="intervalMonths"
    value={maintenanceForm.intervalMonths}
    onChange={handleMaintenanceChange}
    min="1"
    step="1"
    placeholder="Например: 12"
  />
</label>

<label>
  <span>Следующая замена, км</span>
  <input
    type="number"
    name="nextServiceMileage"
    value={maintenanceForm.nextServiceMileage}
    onChange={handleMaintenanceChange}
    min="1"
    placeholder="Например: 245000"
  />
</label>

        <label>
          <span>Привязать к установленной детали</span>

          <select
            name="installedPartId"
            value={maintenanceForm.installedPartId}
            onChange={handleMaintenanceChange}
          >
            <option value="">
              Не привязывать
            </option>

            {installedParts.map((part) => (
              <option
                key={part.id}
                value={part.id}
              >
                {part.name}
                {part.manufacturer
                  ? ` — ${part.manufacturer}`
                  : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="part-note-field">
          <span>Примечание</span>
          <textarea
            name="note"
            value={maintenanceForm.note}
            onChange={handleMaintenanceChange}
            rows="3"
          />
        </label>

        <div className="form-actions">
          <button
  type="button"
  className="secondary-button"
  onClick={handleCancelMaintenanceForm}
  disabled={maintenanceSaving}
>
  Отмена
</button>

          <button
  type="submit"
  className="primary-button"
>
  Сохранить
</button>
        </div>
      </form>
    </section>
  )}

{citroenSection === 'maintenance' && (
  <section className="expenses-section">
    <div className="section-header">
      <h2>Регламентные работы</h2>
    </div>

    {maintenanceLoading ? (
      <p style={{ padding: '20px' }}>
        Загрузка регламентных работ...
      </p>
    ) : (
      <div className="maintenance-card-list">
        {sortedMaintenanceTasks.map(
          (task) => {
            const interval =
              getMaintenanceInterval(task)

            const nextMileage =
              getMaintenanceNextMileage(task)

            const nextDate =
              getMaintenanceNextDate(task)

            const linkedPart =
              getMaintenanceLinkedPart(task)

            const status =
              getMaintenanceStatus(task)

            const statusLabel =
              getMaintenanceStatusLabel(task)

            const isExpanded =
              expandedMaintenanceId ===
              task.id

            return (
              <article
                key={task.id}
                className={`maintenance-card ${status}`}
              >
                <button
                  type="button"
                  className="maintenance-card-summary"
                  onClick={() =>
                    setExpandedMaintenanceId(
                      isExpanded
                        ? null
                        : task.id
                    )
                  }
                >
                  <div className="maintenance-card-title">
                    <strong>
                      {task.name}
                    </strong>

                    {statusLabel && (
                      <span
                        className={`maintenance-status-badge ${status}`}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </div>

                  <div className="maintenance-card-next">
                    {nextMileage && (
                      <span>
                        {nextMileage.toLocaleString(
                          'lt-LT'
                        )}{' '}
                        км
                      </span>
                    )}

                    {nextDate && (
                      <span>
                        {formatDate(
                          nextDate
                        )}
                      </span>
                    )}

                    {!nextMileage &&
                      !nextDate && (
                        <span>—</span>
                      )}
                  </div>

                  <span
                    className={`maintenance-card-arrow ${
                      isExpanded
                        ? 'expanded'
                        : ''
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {isExpanded && (
                  <div className="maintenance-card-details">
                    <div className="maintenance-detail-grid">
                      <div>
                        <span className="maintenance-detail-label">
                          Привязанная деталь
                        </span>

                        <strong>
                          {linkedPart
                            ? `${linkedPart.name}${
                                linkedPart.manufacturer
                                  ? ` — ${linkedPart.manufacturer}`
                                  : ''
                              }`
                            : '—'}
                        </strong>
                      </div>

                      <div>
                        <span className="maintenance-detail-label">
                          Последнее выполнение
                        </span>

                        <strong>
                          {task.lastServiceDate
                            ? formatDate(
                                task.lastServiceDate
                              )
                            : '—'}
                        </strong>

                        {task.lastServiceMileage !=
                          null && (
                          <span>
                            {Number(
                              task.lastServiceMileage
                            ).toLocaleString(
                              'lt-LT'
                            )}{' '}
                            км
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="maintenance-detail-label">
                          Интервал
                        </span>

                        {interval && (
                          <strong>
                            {interval.toLocaleString(
                              'lt-LT'
                            )}{' '}
                            км
                          </strong>
                        )}

                        {task.intervalMonths && (
                          <span>
                            {Number(
                              task.intervalMonths
                            ).toLocaleString(
                              'lt-LT'
                            )}{' '}
                            мес.
                          </span>
                        )}

                        {!interval &&
                          !task.intervalMonths && (
                            <strong>—</strong>
                          )}
                      </div>

                      <div>
                        <span className="maintenance-detail-label">
                          Следующее выполнение
                        </span>

                        {nextMileage && (
                          <>
                            <strong>
                              {nextMileage.toLocaleString(
                                'lt-LT'
                              )}{' '}
                              км
                            </strong>

                            <span
                              className={`maintenance-card-remaining ${status}`}
                            >
                              {formatMaintenanceMileageRemaining(
                                task
                              )}
                            </span>
                          </>
                        )}

                        {nextDate && (
                          <>
                            <strong>
                              {formatDate(
                                nextDate
                              )}
                            </strong>

                            <span
                              className={`maintenance-card-remaining ${getMaintenanceDateStatus(
                                task
                              )}`}
                            >
                              {formatMaintenanceDateRemaining(
                                task
                              )}
                            </span>
                          </>
                        )}

                        {!nextMileage &&
                          !nextDate && (
                            <strong>—</strong>
                          )}
                      </div>
                    </div>

                    {task.note && (
                      <div className="maintenance-card-note">
                        <span className="maintenance-detail-label">
                          Примечание
                        </span>

                        <div>
                          {task.note}
                        </div>
                      </div>
                    )}

                    <div className="maintenance-card-actions">
                      <button
                        type="button"
                        className="edit-button"
                        onClick={() =>
                          handleEditMaintenance(
                            task
                          )
                        }
                      >
                        Редактировать
                      </button>

                      <button
                        type="button"
                        className="delete-button"
                        onClick={() =>
                          handleDeleteMaintenance(
                            task
                          )
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          }
        )}

        {maintenanceTasks.length ===
          0 && (
          <p className="maintenance-cards-empty">
            Регламентные работы пока не
            добавлены.
          </p>
        )}
      </div>
    )}
  </section>
)}

{citroenSection === 'current' && (
    <section className="expenses-section">
      <div className="section-header">
        <h2>Текущие работы</h2>
      </div>
<div className="current-work-summary">
  <div className="current-work-summary-item">
    <span className="current-work-priority-dot high" />
    <span>Высокий</span>
    <strong>{currentWorkCounts.high}</strong>
  </div>

  <div className="current-work-summary-item">
    <span className="current-work-priority-dot medium" />
    <span>Средний</span>
    <strong>{currentWorkCounts.medium}</strong>
  </div>

  <div className="current-work-summary-item">
    <span className="current-work-priority-dot low" />
    <span>Низкий</span>
    <strong>{currentWorkCounts.low}</strong>
  </div>

  <div className="current-work-summary-item">
    <span className="current-work-priority-dot buy" />
    <span>Докупить</span>
    <strong>{currentWorkCounts.buy}</strong>
  </div>
</div>
      <form
        className="current-work-form"
        onSubmit={handleAddCurrentWork}
      >
        <input
          type="text"
          value={currentWorkText}
          onChange={(event) =>
            setCurrentWorkText(event.target.value)
          }
          placeholder="Например: заменить прокладку коллектора"
        />
<select
  value={currentWorkPriority}
  onChange={(event) =>
    setCurrentWorkPriority(event.target.value)
  }
  className="current-work-priority-select"
>
  <option value="high">
    Высокий
  </option>

  <option value="medium">
    Средний
  </option>

  <option value="low">
    Низкий
  </option>

  <option value="buy">
  Докупить
</option>

</select>
        <button
          type="submit"
          className="primary-button"
        >
          Добавить
        </button>
      </form>

      {currentWorksLoading ? (
        <p style={{ padding: '20px' }}>
          Загрузка...
        </p>
      ) : (
        <div className="current-work-list">
          {[...currentWorks]
  .sort((a, b) => {
    const priorityOrder = {
  high: 1,
  medium: 2,
  low: 3,
  buy: 4,
}

    return (
      priorityOrder[a.priority] -
      priorityOrder[b.priority]
    )
  })
  .map((item) => (
    <div
      key={item.id}
      className="current-work-item"
    >
<button
  type="button"
  className={`current-work-priority-dot ${item.priority}`}
  onClick={() =>
    handleChangeCurrentWorkPriority(item)
  }
  title={
  item.priority === 'high'
    ? 'Высокий приоритет — нажмите, чтобы изменить'
    : item.priority === 'medium'
      ? 'Средний приоритет — нажмите, чтобы изменить'
      : item.priority === 'low'
        ? 'Низкий приоритет — нажмите, чтобы изменить'
        : 'Докупить — нажмите, чтобы изменить'
}
  aria-label="Изменить приоритет"
/>

  <span className="current-work-text">
    {item.text}
  </span>

              <button
                type="button"
                className="delete-button"
                onClick={() =>
                  handleDeleteCurrentWork(item)
                }
              >
                Удалить
              </button>
            </div>
          ))}

          {currentWorks.length === 0 && (
            <p>Текущих работ пока нет.</p>
          )}
        </div>
      )}
    </section>
  )}

{citroenSection === 'buy' && (
    <section className="expenses-section">
      <div className="section-header">
        <h2>Купить</h2>
      </div>

      <div className="current-work-summary">
        <div className="current-work-summary-item">
          <span className="current-work-priority-dot high" />
          <span>Высокий</span>
          <strong>{purchaseCounts.high}</strong>
        </div>

        <div className="current-work-summary-item">
          <span className="current-work-priority-dot medium" />
          <span>Средний</span>
          <strong>{purchaseCounts.medium}</strong>
        </div>

        <div className="current-work-summary-item">
          <span className="current-work-priority-dot low" />
          <span>Низкий</span>
          <strong>{purchaseCounts.low}</strong>
        </div>
      </div>

      <form
        className="current-work-form"
        onSubmit={handleAddPurchaseItem}
      >
        <input
          type="text"
          value={purchaseText}
          onChange={(event) =>
            setPurchaseText(event.target.value)
          }
          placeholder="Например: купить прокладку коллектора"
        />

        <select
          value={purchasePriority}
          onChange={(event) =>
            setPurchasePriority(event.target.value)
          }
          className="current-work-priority-select"
        >
          <option value="high">
            Высокий
          </option>

          <option value="medium">
            Средний
          </option>

          <option value="low">
            Низкий
          </option>
        </select>

        <button
          type="submit"
          className="primary-button"
        >
          Добавить
        </button>
      </form>

      {purchaseItemsLoading ? (
        <p style={{ padding: '20px' }}>
          Загрузка...
        </p>
      ) : (
        <div className="current-work-list">
          {[...purchaseItems]
            .sort((a, b) => {
              const priorityOrder = {
                high: 1,
                medium: 2,
                low: 3,
              }

              return (
                priorityOrder[a.priority] -
                priorityOrder[b.priority]
              )
            })
            .map((item) => (
              <div
                key={item.id}
                className="current-work-item"
              >
                <button
                  type="button"
                  className={`current-work-priority-dot ${item.priority}`}
                  onClick={() =>
                    handleChangePurchasePriority(item)
                  }
                  title={
                    item.priority === 'high'
                      ? 'Высокий приоритет — нажмите, чтобы изменить'
                      : item.priority === 'low'
                        ? 'Низкий приоритет — нажмите, чтобы изменить'
                        : 'Средний приоритет — нажмите, чтобы изменить'
                  }
                  aria-label="Изменить приоритет"
                />

                <span className="current-work-text">
                  {item.text}
                </span>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() =>
                    handleDeletePurchaseItem(item)
                  }
                >
                  Удалить
                </button>
              </div>
            ))}

          {purchaseItems.length === 0 && (
            <p>Список покупок пока пуст.</p>
          )}
        </div>
      )}
    </section>
  )}

  {citroenSection === 'notes' && (
  <section className="expenses-section">
    <div className="section-header">
      <h2>Заметки</h2>
    </div>

    {showNoteForm && (
      <form
        className="car-note-form"
        onSubmit={handleNoteSubmit}
      >
        <label>
          <span>Заголовок</span>

          <input
            type="text"
            name="title"
            value={noteForm.title}
            onChange={handleNoteChange}
            placeholder="Например: Размер ремня генератора"
            required
          />
        </label>

        <label className="car-note-content-field">
          <span>Заметка</span>

          <textarea
            name="content"
            value={noteForm.content}
            onChange={handleNoteChange}
            rows="6"
            placeholder="Введите информацию о машине..."
            required
          />
        </label>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleCancelNoteForm}
          >
            Отмена
          </button>

          <button
            type="submit"
            className="primary-button"
          >
            {editingNoteId
              ? 'Сохранить изменения'
              : 'Сохранить'}
          </button>
        </div>
      </form>
    )}

    {carNotesLoading ? (
      <p style={{ padding: '20px' }}>
        Загрузка заметок...
      </p>
    ) : (
      <div className="car-notes-list">
        {carNotes.map((note) => (
          <article
            key={note.id}
            className="car-note-card"
          >
            <div className="car-note-header">
              <h3>{note.title}</h3>

              <div className="car-note-actions">
                <button
                  type="button"
                  className="edit-button"
                  onClick={() =>
                    handleEditCarNote(
                      note
                    )
                  }
                >
                  Редактировать
                </button>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() =>
                    handleDeleteCarNote(
                      note
                    )
                  }
                >
                  Удалить
                </button>
              </div>
            </div>

            <div className="car-note-content">
              {note.content}
            </div>
          </article>
        ))}

        {carNotes.length === 0 && (
          <p className="car-notes-empty">
            Заметок пока нет.
          </p>
        )}
      </div>
    )}
  </section>
)}

{citroenSection === 'expenses' && (
  <>
      <section className="expense-period-section">
  <div className="expense-period-control">
    <span>Период</span>

    <select
      value={expensePeriod}
      onChange={(event) =>
        setExpensePeriod(
          event.target.value
        )
      }
    >
      <option value="1">
        1 месяц
      </option>

      <option value="3">
        3 месяца
      </option>

      <option value="6">
        6 месяцев
      </option>

      <option value="12">
        12 месяцев
      </option>

      <option value="all">
        Всё время
      </option>
    </select>
  </div>

  <article className="stat-card expense-period-total">
    <span>
      {getExpensePeriodLabel()}
    </span>

    <strong>
      {formatMoney(periodTotal)}
    </strong>
  </article>

  <article className="stat-card expense-period-total">
  <span>
    Расходы на 1 км
  </span>

  <strong>
    {periodMileageStats.costPerKm !=
    null
      ? `${periodMileageStats.costPerKm.toLocaleString(
          'lt-LT',
          {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          }
        )} €/км`
      : '—'}
  </strong>

  {periodMileageStats.distanceKm !=
    null && (
    <small className="expense-distance">
      Пройдено:{' '}
      {periodMileageStats.distanceKm.toLocaleString(
        'lt-LT'
      )}{' '}
      км
    </small>
  )}
</article>

</section>

<h2 className="fuel-stats-title">
  Топливо
</h2>

<section className="fuel-period-section">
  
  <article className="stat-card expense-period-total">
    <span>
      Средняя цена за литр
    </span>

    <strong>
      {fuelPeriodStats.averagePrice !=
      null
        ? `${fuelPeriodStats.averagePrice.toLocaleString(
            'lt-LT',
            {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }
          )} €/л`
        : '—'}
    </strong>

    {fuelPeriodStats.totalLiters >
      0 && (
      <small className="expense-distance">
        Заправлено:{' '}
        {fuelPeriodStats.totalLiters.toLocaleString(
          'lt-LT',
          {
            maximumFractionDigits: 2,
          }
        )}{' '}
        л
      </small>
    )}
  </article>

  <article className="stat-card expense-period-total">
    <span>
      Расходы на топливо
    </span>

    <strong>
      {formatMoney(
        fuelPeriodStats.totalCost
      )}
    </strong>

    {fuelPeriodStats.refuelCount >
      0 && (
      <small className="expense-distance">
        Заправок:{' '}
        {fuelPeriodStats.refuelCount}
      </small>
    )}
  </article>

  <article className="stat-card expense-period-total">
    <span>
      Расход на 1 км
    </span>

    <strong>
      {fuelPeriodStats.costPerKm !=
      null
        ? `${fuelPeriodStats.costPerKm.toLocaleString(
            'lt-LT',
            {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }
          )} €/км`
        : '—'}
    </strong>

    {fuelPeriodStats.completedDistance >
      0 && (
      <small className="expense-distance">
        Учтено:{' '}
        {fuelPeriodStats.completedDistance.toLocaleString(
          'lt-LT'
        )}{' '}
        км
      </small>
    )}
  </article>
</section>

      <section className="expenses-section">
        <div className="section-header">
          <h2>Последние расходы</h2>
        </div>

        <div className="expense-card-list">
  {periodExpenses.map((expense) => {
    const isExpanded =
      expandedExpenseId === expense.id

    const isFuel =
      expense.category === 'Топливо'

    const fuelVolume =
      Number(expense.fuelVolume)

    const fuelPricePerLiter =
      isFuel &&
      fuelVolume > 0 &&
      Number(expense.amount) > 0
        ? Number(expense.amount) /
          fuelVolume
        : null

    return (
      <article
        key={expense.id}
        className="expense-card"
      >
        <button
          type="button"
          className="expense-card-summary"
          onClick={() =>
            setExpandedExpenseId(
              isExpanded
                ? null
                : expense.id
            )
          }
        >
          <div className="expense-card-main">
            <span className="expense-card-date">
              {formatDate(expense.date)}
            </span>

            <strong className="expense-card-category">
              {expense.category}
            </strong>
          </div>

          <strong className="expense-card-amount">
            {formatMoney(
              expense.amount
            )}
          </strong>

          <span
            className={`expense-card-arrow ${
              isExpanded
                ? 'expanded'
                : ''
            }`}
          >
            ▾
          </span>
        </button>

        {isExpanded && (
          <div className="expense-card-details">
            <div className="expense-detail-grid">
              <div>
                <span className="expense-detail-label">
                  Описание
                </span>

                <strong>
                  {expense.description ||
                    '—'}
                </strong>
              </div>

              <div>
                <span className="expense-detail-label">
                  Пробег
                </span>

                <strong>
                  {expense.mileage != null &&
                  expense.mileage !== ''
                    ? `${Number(
                        expense.mileage
                      ).toLocaleString(
                        'lt-LT'
                      )} км`
                    : '—'}
                </strong>
              </div>

              <div>
                <span className="expense-detail-label">
                  Сумма
                </span>

                <strong>
                  {formatMoney(
                    expense.amount
                  )}
                </strong>
              </div>

              {isFuel && (
                <>
                  <div>
                    <span className="expense-detail-label">
                      Объём
                    </span>

                    <strong>
                      {fuelVolume > 0
                        ? `${fuelVolume.toLocaleString(
                            'lt-LT',
                            {
                              maximumFractionDigits: 2,
                            }
                          )} л`
                        : '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="expense-detail-label">
                      Цена за литр
                    </span>

                    <strong>
                      {fuelPricePerLiter !=
                      null
                        ? `${fuelPricePerLiter.toLocaleString(
                            'lt-LT',
                            {
                              minimumFractionDigits: 3,
                              maximumFractionDigits: 3,
                            }
                          )} €/л`
                        : '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="expense-detail-label">
                      Полный бак
                    </span>

                    <strong>
                      {expense.fullTank
                        ? 'Да'
                        : 'Нет'}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div className="expense-card-actions">
              <button
                type="button"
                className="edit-button"
                onClick={() =>
                  handleEditExpense(
                    expense
                  )
                }
              >
                Редактировать
              </button>

              <button
                type="button"
                className="delete-button"
                onClick={() =>
                  handleDeleteExpense(
                    expense
                  )
                }
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </article>
    )
  })}

  {periodExpenses.length === 0 && (
    <p className="expense-cards-empty">
      За выбранный период расходов нет.
    </p>
  )}
</div>
          </section>

    </>
  )}

{openedPartPhoto && (
  <div
    className="photo-lightbox"
    onClick={() => setOpenedPartPhoto(null)}
  >
    <button
      type="button"
      className="photo-lightbox-close"
      onClick={() => setOpenedPartPhoto(null)}
      aria-label="Закрыть фото"
    >
      ×
    </button>

    <img
      src={openedPartPhoto}
      alt="Фото установленной детали"
      className="photo-lightbox-image"
      onClick={(event) =>
        event.stopPropagation()
      }
    />
  </div>
)}

    </main>
  )
}

export default App