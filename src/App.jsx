import { useEffect, useMemo, useState } from 'react'
import './App.css'

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
const [expenses, setExpenses] = useState(() => {
  const savedExpenses = localStorage.getItem(STORAGE_KEY)

  if (!savedExpenses) {
    return initialExpenses
  }

  try {
const parsed = JSON.parse(savedExpenses)

return parsed.map((expense) => ({
  ...expense,
  object: expense.object || 'citroen',
}))
  } catch {
    return initialExpenses
  }
})
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
useEffect(() => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(expenses)
  )
}, [expenses])
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

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }
function resetForm() {
  setForm({
    date: getTodayDate(),
    category:
      selectedObject === 'garage'
        ? 'Инструмент'
        : 'Запчасти',
    description: '',
    mileage: '',
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
    amount: expense.amount,
  })

  setShowForm(true)

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}
 function handleSubmit(event) {
  event.preventDefault()

  const amount = Number(form.amount)

  if (!form.date || !form.description.trim() || amount <= 0) {
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

  if (editingExpenseId) {
    setExpenses((current) =>
      current.map((expense) =>
        expense.id === editingExpenseId
          ? {
              ...expense,
              ...expenseData,
            }
          : expense
      )
    )
  } else {
    setExpenses((current) => [
      {
        id: Date.now(),
        ...expenseData,
      },
      ...current,
    ])
  }

  resetForm()
  setEditingExpenseId(null)
  setShowForm(false)
}
function handleDeleteExpense(expense) {
  const confirmed = window.confirm(
    `Удалить расход "${expense.description}" на ${formatMoney(expense.amount)}?`
  )

  if (!confirmed) {
    return
  }

  setExpenses((current) =>
    current.filter((item) => item.id !== expense.id)
  )
}
  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Car Expenses</h1>
          <p>Учёт расходов на автомобиль</p>
        </div>

        <button
          className="primary-button"
          onClick={handleOpenAddForm}
        >
          + Добавить расход
        </button>
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
                required
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
        Citroën C4 1.6
      </option>

      <option value="garage">
        Гараж
      </option>
    </select>
  </label>
</section>

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
    </main>
  )
}

export default App