import { useEffect, useMemo, useState } from 'react'
import './App.css'
import AuthScreen from './AuthScreen'
import { supabase } from './lib/supabaseClient'

import {
  getAllExpenses,
  saveExpense,
  deleteExpense,
  getInstalledParts,
  saveInstalledPart,
  deleteInstalledPart,
  uploadInstalledPartPhotos,
  getMaintenanceTasks,
saveMaintenanceTask,
deleteMaintenanceTask,
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

const garageCategories = [
  'Инструмент',
  'Оборудование',
  'Расходные материалы',
  'Ремонт гаража',
  'Электричество',
  'Аренда и сборы',
  'Прочее',
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
const [maintenanceLoading, setMaintenanceLoading] = useState(true)
const [maintenanceSortOrder, setMaintenanceSortOrder] =
  useState('asc')
const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
const [editingMaintenanceId, setEditingMaintenanceId] = useState(null)

const [maintenanceForm, setMaintenanceForm] = useState({
  name: '',
  lastServiceDate: getTodayDate(),
  lastServiceMileage: '',
  intervalKm: '',
  nextServiceMileage: '',
  installedPartId: '',
  note: '',
})
const [citroenSection, setCitroenSection] = useState('expenses')

const [showPartForm, setShowPartForm] = useState(false)
const [editingPartId, setEditingPartId] = useState(null)
const [newPartPhotos, setNewPartPhotos] = useState([])
const [selectedInstalledPart, setSelectedInstalledPart] = useState(null)
const [replacementSortOrder, setReplacementSortOrder] =
  useState('asc')
const [partForm, setPartForm] = useState({
  name: '',
  quantity: 1,
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
const [selectedObject, setSelectedObject] = useState('citroen')
const [editingExpenseId, setEditingExpenseId] = useState(null)

  const [form, setForm] = useState({
  date: getTodayDate(),
  category: 'Запчасти',
  description: '',
  mileage: '',
  amount: '',
})

const filteredExpenses = useMemo(() => {
  return expenses.filter(
    (expense) => expense.object === selectedObject
  )
}, [expenses, selectedObject])
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

const sortedMaintenanceTasks = useMemo(() => {
  return [...maintenanceTasks].sort((a, b) => {
    const nextA = getMaintenanceNextMileage(a)
    const nextB = getMaintenanceNextMileage(b)

    if (nextA == null && nextB == null) {
      return 0
    }

    if (nextA == null) {
      return 1
    }

    if (nextB == null) {
      return -1
    }

    if (maintenanceSortOrder === 'asc') {
      return nextA - nextB
    }

    return nextB - nextA
  })
}, [
  maintenanceTasks,
  maintenanceSortOrder,
  installedParts,
])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
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

function isMaintenanceOverdue(task) {
  const nextMileage =
    getMaintenanceNextMileage(task)

  const currentMileage =
    Number(getLastMileage())

  if (!nextMileage || !currentMileage) {
    return false
  }

  return currentMileage > nextMileage
}



const sortedInstalledParts = useMemo(() => {
  return [...installedParts].sort((a, b) => {
    const replacementA = getReplacementMileage(a)
    const replacementB = getReplacementMileage(b)

    if (replacementA === null && replacementB === null) {
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
}, [installedParts, replacementSortOrder])

function resetForm() {
  setForm({
    date: getTodayDate(),
    category:
      selectedObject === 'garage'
        ? 'Инструмент'
        : 'Запчасти',
    description: '',
mileage:
  selectedObject === 'citroen'
    ? getLastMileage()
    : '',
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
setSelectedObject(expense.object)

  setForm({
    date: expense.date,
    category: expense.category,
    description: expense.description,
    mileage: expense.mileage ?? '',
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
    quantity: 1,
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
function handleEditInstalledPart(part) {
  setEditingPartId(part.id)
  setNewPartPhotos([])

  setPartForm({
    name: part.name || '',
    quantity: part.quantity || 1,
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
  quantity: Number(partForm.quantity) || 1,
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

  if (!maintenanceForm.name.trim()) {
    return
  }

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
  }
}

async function handleSubmit(event) {
  event.preventDefault()
const objectToKeep = selectedObject
  const amount = Number(form.amount)

  if (!form.date || amount <= 0) {
  return
}

  const expenseData = {
    object: selectedObject,
    date: form.date,
    category: form.category,
    description: form.description.trim(),
    mileage:
      form.mileage === ''
        ? null
        : Number(form.mileage),
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
setSelectedObject(objectToKeep)
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
  <h1>Car Expenses</h1>
  <span className="app-version">v2.0.0</span>
</div>
</div>

        <div className="header-actions">
{selectedObject === 'citroen' &&
citroenSection === 'parts' ? (
  <button
    className="primary-button"
    onClick={handleOpenAddPart}
  >
    + Добавить деталь
  </button>
) : selectedObject === 'citroen' &&
  citroenSection === 'maintenance' ? (
  <button
    className="primary-button"
    onClick={handleOpenAddMaintenance}
  >
    + Добавить работу
  </button>
) : (
  <button
    className="primary-button"
    onClick={handleOpenAddForm}
  >
    + Добавить расход
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
                {(
  selectedObject === 'garage'
    ? garageCategories
    : carCategories
).map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="description-field">
              <span>Описание</span>

              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleChange}
              placeholder={
  selectedObject === 'garage'
    ? 'Например: набор ключей'
    : 'Например: моторное масло'
}

              />
            </label>

            {selectedObject === 'citroen' && (
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

      <section className="filters">
  <label>
    <span>Объект</span>

    <select
      value={selectedObject}
      onChange={(event) =>
        setSelectedObject(event.target.value)
      }
    >
      <option value="citroen">
        Citroën
      </option>

      <option value="garage">
        Гараж
      </option>
    </select>
  </label>
</section>

{selectedObject === 'citroen' && (
  <div className="section-tabs">
    <button
      type="button"
      className={
        citroenSection === 'expenses'
          ? 'section-tab active'
          : 'section-tab'
      }
      onClick={() => setCitroenSection('expenses')}
    >
      Расходы
    </button>

    <button
      type="button"
      className={
        citroenSection === 'parts'
          ? 'section-tab active'
          : 'section-tab'
      }
      onClick={() => setCitroenSection('parts')}
    >
      Установленные детали
    </button>
<button
  type="button"
  className={
    citroenSection === 'maintenance'
      ? 'section-tab active'
      : 'section-tab'
  }
  onClick={() => setCitroenSection('maintenance')}
>
  Регламентные работы
</button>

  </div>
)}
{selectedObject === 'citroen' &&
  citroenSection === 'parts' &&
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
          <span>Количество</span>
          <input
            type="number"
            name="quantity"
            value={partForm.quantity}
            onChange={handlePartChange}
            min="1"
            step="1"
            required
          />
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
          >
            Сохранить
          </button>
        </div>
      </form>
    </section>
  )}
{selectedObject === 'citroen' &&
  citroenSection === 'parts' && (
    <>
      {selectedInstalledPart ? (
        <section className="part-detail">
<div className="detail-actions">
  <button
    type="button"
    className="secondary-button"
    onClick={() => setSelectedInstalledPart(null)}
  >
    ← Назад к списку
  </button>

  <button
    type="button"
    className="edit-button"
    onClick={() =>
      handleEditInstalledPart(selectedInstalledPart)
    }
  >
    Редактировать
  </button>
</div>

          <h2>{selectedInstalledPart.name}</h2>

          {selectedInstalledPart.photos?.length > 0 && (
            <div className="installed-part-photos">
              {selectedInstalledPart.photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={selectedInstalledPart.name}
                  className="installed-part-photo"
                />
              ))}
            </div>
          )}

          <div className="part-detail-fields">
            <p>
              <strong>Дата установки:</strong>{' '}
              {formatDate(
                selectedInstalledPart.installedDate
              )}
            </p>
<p>
  <strong>Количество:</strong>{' '}
  {selectedInstalledPart.quantity || 1}
</p>
            <p>
              <strong>Пробег:</strong>{' '}
              {selectedInstalledPart.mileage
                ? `${selectedInstalledPart.mileage.toLocaleString(
                    'lt-LT'
                  )} км`
                : '—'}
            </p>
<p>
  <strong>Ресурс:</strong>{' '}
  {selectedInstalledPart.serviceLifeKm
    ? `${selectedInstalledPart.serviceLifeKm.toLocaleString(
        'lt-LT'
      )} км`
    : '—'}
</p>
            <p>
              <strong>Производитель:</strong>{' '}
              {selectedInstalledPart.manufacturer || '—'}
            </p>

            <p>
              <strong>Артикул:</strong>{' '}
              {selectedInstalledPart.article || '—'}
            </p>

            <p>
              <strong>OEM:</strong>{' '}
              {selectedInstalledPart.oem || '—'}
            </p>
          </div>

          {selectedInstalledPart.note && (
            <div className="part-note">
              <strong>Примечание</strong>
              <p>{selectedInstalledPart.note}</p>
            </div>
          )}
        </section>
      ) : (
        <section className="expenses-section">
          <div className="section-header">
            <h2>Установленные детали</h2>
          </div>

          {installedPartsLoading ? (
            <p style={{ padding: '20px' }}>
              Загрузка деталей...
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Деталь</th>
                    <th>Производитель</th>
                    <th>Артикул</th>
                    <th>Пробег</th>
                    <th>
  <button
    type="button"
    className="table-sort-button"
    onClick={() =>
      setReplacementSortOrder((current) =>
        current === 'asc' ? 'desc' : 'asc'
      )
    }
  >
    Замена
    <span className="sort-arrow">
      {replacementSortOrder === 'asc' ? '↑' : '↓'}
    </span>
  </button>
</th>
                    
                  </tr>
                </thead>

                <tbody>
                  {sortedInstalledParts.map((part) => (
                    <tr
                      key={part.id}
                      className="installed-part-row"
                      onClick={() =>
                        setSelectedInstalledPart(part)
                      }
                    >
                      <td>
                        {formatDate(part.installedDate)}
                      </td>

                      <td>{part.name}</td>

                      <td>
                        {part.manufacturer || '—'}
                      </td>

                      <td>
                        {part.article || '—'}
                      </td>
<td>
                        {part.mileage
                          ? `${part.mileage.toLocaleString(
                              'lt-LT'
                            )} км`
                          : '—'}
                      </td>
                      <td
  className={
    isReplacementOverdue(part)
      ? 'replacement-mileage overdue'
      : 'replacement-mileage'
  }
>
  {getReplacementMileage(part)
    ? `${getReplacementMileage(part).toLocaleString(
        'lt-LT'
      )} км`
    : '—'}
</td>

                      
                    </tr>
                  ))}

                  {installedParts.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        Установленных деталей пока нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )}

{selectedObject === 'citroen' &&
  citroenSection === 'maintenance' &&
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

{selectedObject === 'citroen' &&
  citroenSection === 'maintenance' && (
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
                <th>Последний пробег</th>
                <th>Интервал / ресурс</th>
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

                  const linkedPart =
                  getMaintenanceLinkedPart(task)

                return (
                  <tr key={task.id}>
                    <td>{task.name}</td>
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
                      {task.lastServiceMileage
                        ? `${Number(
                            task.lastServiceMileage
                          ).toLocaleString(
                            'lt-LT'
                          )} км`
                        : '—'}
                    </td>

                    <td>
                      {interval
                        ? `${interval.toLocaleString(
                            'lt-LT'
                          )} км`
                        : '—'}
                    </td>

                    <td
                      className={
                        isMaintenanceOverdue(task)
                          ? 'replacement-mileage overdue'
                          : 'replacement-mileage'
                      }
                    >
                      {nextMileage
                        ? `${nextMileage.toLocaleString(
                            'lt-LT'
                          )} км`
                        : '—'}
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

{(
  selectedObject === 'garage' ||
  citroenSection === 'expenses'
) && (
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
                {selectedObject === 'citroen' && (
  <th>Пробег</th>
)}
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

              {selectedObject === 'citroen' && (
  <td>
    {expense.mileage
      ? `${expense.mileage.toLocaleString('lt-LT')} км`
      : '—'}
  </td>
)}

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

    </main>
  )
}

export default App