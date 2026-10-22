import { useEffect, useMemo, useState } from 'react'
import './App.css'
import AuthScreen from './AuthScreen'
import { supabase } from './lib/supabaseClient'

import {
  getAllExpenses,
  saveExpense,
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

function App() {
  const [session, setSession] = useState(null)
const [authLoading, setAuthLoading] = useState(true)

useEffect(() => {
  let mounted = true

  supabase.auth
    .getSession()
    .then(({ data }) => {
      if (!mounted) return

      setSession(data.session)
      setAuthLoading(false)
    })

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (_event, currentSession) => {
      if (!mounted) return

      setSession(currentSession)
      setAuthLoading(false)
    }
  )

  return () => {
    mounted = false
    subscription.unsubscribe()
  }
}, [])

const [expenses, setExpenses] = useState([])
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
const [replacementSortOrder, setReplacementSortOrder] =
  useState('asc')
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
    if (!session) {
      setExpenses([])
      setExpensesLoading(false)
      return
    }

    try {
      setExpensesLoading(true)

      const data = await getAllExpenses()

      setExpenses(data)
    } catch (error) {
      console.error('Ошибка загрузки расходов:', error)
    } finally {
      setExpensesLoading(false)
    }
  }

  loadExpenses()
}, [session?.user?.id])

useEffect(() => {
  async function loadInstalledParts() {
    if (!session) {
      setInstalledParts([])
      setInstalledPartsLoading(false)
      return
    }

    try {
      setInstalledPartsLoading(true)

      const data = await getInstalledParts()

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
}, [session?.user?.id])

useEffect(() => {
  async function loadMaintenanceTasks() {
    if (!session) {
      setMaintenanceTasks([])
      setMaintenanceLoading(false)
      return
    }

    try {
      setMaintenanceLoading(true)

      const data = await getMaintenanceTasks()

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
}, [session?.user?.id])

useEffect(() => {
  async function loadCurrentWorks() {
    if (!session) {
      setCurrentWorks([])
      setCurrentWorksLoading(false)
      return
    }

    try {
      setCurrentWorksLoading(true)

      const data = await getCurrentWorks()

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
}, [session?.user?.id])

useEffect(() => {
  async function loadPurchaseItems() {
    if (!session) {
      setPurchaseItems([])
      setPurchaseItemsLoading(false)
      return
    }

    try {
      setPurchaseItemsLoading(true)

      const data = await getPurchaseItems()

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
}, [session?.user?.id])

useEffect(() => {
  async function loadCarNotes() {
    if (!session) {
      setCarNotes([])
      setCarNotesLoading(false)
      return
    }

    try {
      setCarNotesLoading(true)

      const data = await getCarNotes()

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
}, [session?.user?.id])

async function refreshPurchaseItems() {
  const data = await getPurchaseItems()
  setPurchaseItems(data)
}

async function refreshCarNotes() {
  const data = await getCarNotes()
  setCarNotes(data)
}

async function refreshCurrentWorks() {
  const data = await getCurrentWorks()
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
  const data = await getMaintenanceTasks()
  setMaintenanceTasks(data)

  return data
}

async function refreshInstalledParts() {
  const data = await getInstalledParts()
  setInstalledParts(data)

  return data
}

async function refreshExpenses() {
  const data = await getAllExpenses()
  setExpenses(data)
}
const [showForm, setShowForm] = useState(false)

const [editingExpenseId, setEditingExpenseId] = useState(null)

  const [form, setForm] = useState({
  date: getTodayDate(),
  category: 'Запчасти',
  description: '',
  mileage: '',
    fuelVolume: '',
      fullTank: false,
  amount: '',
})

const filteredExpenses = useMemo(() => {
  return expenses.filter(
    (expense) => expense.object === 'citroen'
  )
}, [expenses])

  const totals = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let month = 0
    let year = 0
    let all = 0

for (const expense of filteredExpenses) {
      const expenseDate = new Date(
        `${expense.date}T12:00:00`
      )

      all += expense.amount

      if (expenseDate.getFullYear() === currentYear) {
        year += expense.amount

        if (expenseDate.getMonth() === currentMonth) {
          month += expense.amount
        }
      }
    }

    return {
      month,
      year,
      all,
    }
}, [filteredExpenses])

const lastFuelStats = useMemo(() => {
  const fuelExpenses = filteredExpenses
    .filter(
      (expense) =>
        expense.category === 'Топливо' &&
        expense.fuelVolume &&
        Number(expense.fuelVolume) > 0
    )
    .sort((a, b) => {
      const dateDifference =
        new Date(`${a.date}T12:00:00`) -
        new Date(`${b.date}T12:00:00`)

      if (dateDifference !== 0) {
        return dateDifference
      }

      return (
        Number(a.mileage || 0) -
        Number(b.mileage || 0)
      )
    })

 if (fuelExpenses.length === 0) {
  return {
    date: null,
    mileage: null,
    liters: null,
    pricePerLiter: null,
    previousConsumption: null,
  }
}

  const lastFuel =
    fuelExpenses[fuelExpenses.length - 1]

  const liters =
    Number(lastFuel.fuelVolume)

  const pricePerLiter =
    liters > 0
      ? Number(lastFuel.amount) / liters
      : null

  const fullTankExpenses =
    fuelExpenses.filter(
      (expense) =>
        expense.fullTank &&
        expense.mileage !== null &&
        expense.mileage !== undefined &&
        Number.isFinite(Number(expense.mileage))
    )

  let previousConsumption = null

  if (fullTankExpenses.length >= 2) {
    const lastFullTank =
      fullTankExpenses[
        fullTankExpenses.length - 1
      ]

    const previousFullTank =
      fullTankExpenses[
        fullTankExpenses.length - 2
      ]

    const startIndex =
      fuelExpenses.findIndex(
        (expense) =>
          expense.id === previousFullTank.id
      )

    const endIndex =
      fuelExpenses.findIndex(
        (expense) =>
          expense.id === lastFullTank.id
      )

    const distance =
      Number(lastFullTank.mileage) -
      Number(previousFullTank.mileage)

    const fuelUsed =
      fuelExpenses
        .slice(startIndex + 1, endIndex + 1)
        .reduce(
          (sum, expense) =>
            sum +
            Number(expense.fuelVolume || 0),
          0
        )

    if (
      startIndex >= 0 &&
      endIndex > startIndex &&
      distance > 0 &&
      fuelUsed > 0
    ) {
      previousConsumption =
        (fuelUsed / distance) * 100
    }
  }

  return {
  date: lastFuel.date,
  mileage: lastFuel.mileage ?? null,
  liters,
  pricePerLiter,
  previousConsumption,
}

}, [filteredExpenses])

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
  const lastExpenseWithMileage = expenses.find(
    (expense) =>
      expense.object === 'citroen' &&
      expense.mileage !== null &&
      expense.mileage !== undefined
  )

  return lastExpenseWithMileage?.mileage ?? ''
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
    .sort((a, b) => {
      const replacementA =
        getReplacementMileage(a)

      const replacementB =
        getReplacementMileage(b)

      if (
        replacementA === null &&
        replacementB === null
      ) {
        return 0
      }

      if (replacementA === null) {
        return 1
      }

      if (replacementB === null) {
        return -1
      }

      if (replacementSortOrder === 'asc') {
        return replacementA - replacementB
      }

      return replacementB - replacementA
    })
}, [
  installedParts,
  replacementSortOrder,
  installedPartCategory,
  installedPartSearch,
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

  if (!partForm.name.trim()) {
    return
  }

  try {
const partId = await saveInstalledPart({
  id: editingPartId || undefined,
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

  const text = currentWorkText.trim()

  if (!text) {
    return
  }

  try {
await addCurrentWork(
  text,
  currentWorkPriority
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

  const text = purchaseText.trim()

  if (!text) {
    return
  }

  try {
    await addPurchaseItem(
      text,
      purchasePriority
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
object: 'citroen',
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
<span className="app-version">v3.4.0</span>
</div>
</div>
<div className="header-section-control">
  <select
    value={citroenSection}
    onChange={(event) =>
      setCitroenSection(event.target.value)
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

<div className="header-actions">
  {citroenSection === 'expenses' && (
    <button
      className="primary-button"
      onClick={handleOpenAddForm}
    >
      + Добавить расход
    </button>
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
      <h2>Главная</h2>

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
                  <th>Дата</th>
                  <th>Деталь</th>
  
                  <th>Установлено</th>
                  <th>Ресурс</th>

                  <th>
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() =>
                        setReplacementSortOrder(
                          (current) =>
                            current === 'asc'
                              ? 'desc'
                              : 'asc'
                        )
                      }
                    >
                      Замена{' '}
                      {replacementSortOrder ===
                      'asc'
                        ? '↑'
                        : '↓'}
                    </button>
                  </th>

                  <th>Осталось</th>
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
                    <td colSpan="6">
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
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Работа</th>
                <th>Привязанная деталь</th>
                <th>Последнее выполнение</th>
                <th>Интервал</th>
                <th>
  <button
    type="button"
    className="table-sort-button"
    onClick={() =>
      setMaintenanceSortOrder((current) =>
        current === 'asc' ? 'desc' : 'asc'
      )
    }
  >
    Следующая замена
    <span className="sort-arrow">
      {maintenanceSortOrder === 'asc' ? '↑' : '↓'}
    </span>
  </button>
</th>
                <th>Действия</th>
              </tr>
            </thead>

            <tbody>
              {sortedMaintenanceTasks.map((task) => {
                const interval =
                  getMaintenanceInterval(task)

                const nextMileage =
                  getMaintenanceNextMileage(task)

                  const nextDate =
  getMaintenanceNextDate(task)

                  const linkedPart =
                  getMaintenanceLinkedPart(task)

                return (
                  <tr key={task.id}>
                    <td>
  <div className="maintenance-task-name">
    <span>{task.name}</span>

    {getMaintenanceStatusLabel(task) && (
      <span
        className={`maintenance-status-badge ${getMaintenanceStatus(
          task
        )}`}
      >
        {getMaintenanceStatusLabel(
          task
        )}
      </span>
    )}
  </div>
</td>
  <td>
  {linkedPart ? (
    <>
      {linkedPart.name}

      {linkedPart.manufacturer
        ? ` — ${linkedPart.manufacturer}`
        : ''}
    </>
  ) : (
    '—'
  )}
</td>
                    <td>
  {task.lastServiceDate && (
    <div>
      {formatDate(
        task.lastServiceDate
      )}
    </div>
  )}

  {task.lastServiceMileage && (
    <div>
      {Number(
        task.lastServiceMileage
      ).toLocaleString(
        'lt-LT'
      )} км
    </div>
  )}

  {!task.lastServiceDate &&
    !task.lastServiceMileage &&
    '—'}
</td>

                    <td>
  {interval && (
    <div>
      {interval.toLocaleString(
        'lt-LT'
      )} км
    </div>
  )}

  {task.intervalMonths && (
    <div>
      {Number(
        task.intervalMonths
      ).toLocaleString(
        'lt-LT'
      )} мес.
    </div>
  )}

  {!interval &&
    !task.intervalMonths &&
    '—'}
</td>
                    <td
                      className={`replacement-mileage ${getMaintenanceStatus(
  task
)}`}
                    >
                      {nextMileage && (
  <div>
    <div>
      {nextMileage.toLocaleString(
        'lt-LT'
      )} км
    </div>

    <div className="maintenance-remaining-hint">
      {formatMaintenanceMileageRemaining(
        task
      )}
    </div>
  </div>
)}

{nextDate && (
  <div className="maintenance-date-block">
    <div>
      {formatDate(nextDate)}
    </div>

    <div
      className={`maintenance-date-remaining ${getMaintenanceDateStatus(
        task
      )}`}
    >
      {formatMaintenanceDateRemaining(
        task
      )}
    </div>
  </div>
)}

{!nextMileage &&
  !nextDate &&
  '—'}
                    </td>

                    <td className="expense-actions">
  <button
    type="button"
    className="edit-button"
    onClick={() =>
      handleEditMaintenance(task)
    }
  >
    Редактировать
  </button>

  <button
    type="button"
    className="delete-button"
    onClick={() =>
      handleDeleteMaintenance(task)
    }
  >
    Удалить
  </button>
</td>

                  </tr>
                )
              })}

              {maintenanceTasks.length === 0 && (
                <tr>
                  <td colSpan="6">
                    Регламентные работы пока не добавлены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
      <section className="stats">
        <article className="stat-card">
          <span>Этот месяц</span>
          <strong>
            {formatMoney(totals.month)}
          </strong>
        </article>

        <article className="stat-card">
          <span>Этот год</span>
          <strong>
            {formatMoney(totals.year)}
          </strong>
        </article>

        <article className="stat-card">
          <span>Всего</span>
          <strong>
            {formatMoney(totals.all)}
          </strong>
        </article>
      </section>

<h2 className="fuel-stats-title">
  Последняя заправка
</h2>

{lastFuelStats.date && (
  <p className="fuel-stats-meta">
    {formatDate(lastFuelStats.date)}

    {lastFuelStats.mileage != null && (
      <>
        {' • '}
        {Number(
          lastFuelStats.mileage
        ).toLocaleString('lt-LT')}{' '}
        км
      </>
    )}
  </p>
)}

<section className="stats fuel-stats">
  <article className="stat-card">
    <span>Заправлено</span>

    <strong>
      {lastFuelStats.liters != null
        ? `${lastFuelStats.liters.toLocaleString(
            'lt-LT',
            {
              minimumFractionDigits: 1,
              maximumFractionDigits: 2,
            }
          )} л`
        : '—'}
    </strong>
  </article>

  <article className="stat-card">
    <span>Цена за литр</span>

    <strong>
      {lastFuelStats.pricePerLiter != null
        ? `${lastFuelStats.pricePerLiter.toLocaleString(
            'lt-LT',
            {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }
          )} €/л`
        : '—'}
    </strong>
  </article>

  <article className="stat-card">
    <span>Предыдущий расход</span>

    <strong>
      {lastFuelStats.previousConsumption != null
        ? `${lastFuelStats.previousConsumption.toLocaleString(
            'lt-LT',
            {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }
          )} л/100 км`
        : '—'}
    </strong>
  </article>
</section>

      <section className="expenses-section">
        <div className="section-header">
          <h2>Последние расходы</h2>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Категория</th>
                <th>Описание</th>
<th>Пробег</th>
<th>Объём</th>
<th>€/л</th>
<th>Бак</th>
                <th>Сумма</th>
                <th>Действия</th>
              </tr>
            </thead>

            <tbody>
           {filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.date)}</td>
                  <td>{expense.category}</td>
                  <td>{expense.description}</td>

              <td>
  {expense.mileage
    ? `${expense.mileage.toLocaleString('lt-LT')} км`
    : '—'}
</td>

<td>
  {expense.category === 'Топливо' &&
  expense.fuelVolume
    ? `${expense.fuelVolume.toLocaleString(
        'lt-LT',
        {
          maximumFractionDigits: 2,
        }
      )} л`
    : '—'}
</td>

<td>
  {expense.category === 'Топливо' &&
  expense.fuelVolume &&
  expense.amount
    ? `${(
        expense.amount /
        expense.fuelVolume
      ).toLocaleString('lt-LT', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })} €/л`
    : '—'}
</td>

<td>
  {expense.category === 'Топливо' &&
  expense.fullTank ? (
    <span
      className="full-tank-badge"
      title="Полный бак"
      aria-label="Полный бак"
    >
      ✓
    </span>
  ) : (
    '—'
  )}
</td>

                  <td>
                    {formatMoney(expense.amount)}
                  </td>
                  <td className="expense-actions">
                    <button
  type="button"
  className="edit-button"
  onClick={() => handleEditExpense(expense)}
>
  Редактировать
</button>
  <button
    type="button"
    className="delete-button"
    onClick={() => handleDeleteExpense(expense)}
  >
    Удалить
  </button>
</td>
                </tr>
              ))}
            </tbody>
          </table>
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