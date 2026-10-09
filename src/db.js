import { supabase } from './lib/supabaseClient'

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