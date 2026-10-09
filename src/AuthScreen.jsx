import { useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setLoading(true)
    setMessage('')

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error

        setMessage(
          'Регистрация выполнена. Если Supabase запросит подтверждение email, проверьте почту.'
        )
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          })

        if (error) throw error
      }
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Car Expenses</h1>

        <p>
          {mode === 'signin'
            ? 'Войдите в аккаунт'
            : 'Создайте аккаунт'}
        </p>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>Email</span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />
          </label>

          <label>
            <span>Пароль</span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              minLength="6"
              required
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? 'Подождите...'
              : mode === 'signin'
                ? 'Войти'
                : 'Зарегистрироваться'}
          </button>
        </form>

        {message && (
          <p className="auth-message">
            {message}
          </p>
        )}

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMessage('')
            setMode(
              mode === 'signin'
                ? 'signup'
                : 'signin'
            )
          }}
        >
          {mode === 'signin'
            ? 'Нет аккаунта? Зарегистрироваться'
            : 'Уже есть аккаунт? Войти'}
        </button>
      </section>
    </main>
  )
}

export default AuthScreen