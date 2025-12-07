import { useState } from 'react'
import './App.css'

function App() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [excuse, setExcuse] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [roast, setRoast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      excuse: excuse.trim()
    }

    try {
      const response = await fetch('/api/submit-plea', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok && !data.expired) {
        console.log('Submission:', payload)
        setSubmitted(true)
        setRoast(null)
        setName('')
        setPhone('')
        setExcuse('')
      } else if (data.expired) {
        // Ignore the backend roast, give them the cold hard truth
        setRoast("Honey, the list is closed. You missed the window. Sorry.")
      } else {
        // Other errors
        setRoast(data.error || 'Submission failed')
      }
    } catch (err) {
      console.error('Plea submission failed:', err)
      setRoast('Failed to submit plea. Try again?')
    } finally {
      setLoading(false)
    }
  }

  const handleInvalid = (e: React.InvalidEvent<HTMLInputElement | HTMLTextAreaElement>, message: string) => {
    e.target.setCustomValidity(message)
  }

  const handleInput = (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.setCustomValidity('')
  }

  return (
    <div className="container">
      <header>
        <h1>D-List Access</h1>
        <p className="subtitle">BEAUTIFUL. DIRTY. RICH.</p>
      </header>

      <main>
        {submitted ? (
          <div className="judgment-zone">
            <p>We've received your plea.</p>
            <p>Don't hold your breath.</p>
          </div>
        ) : roast ? (
          <div className="judgment-zone">
            <p>{roast}</p>
          </div>
        ) : (
          <>
            <div className="judgment-zone">
              <p>You can't follow the theme. That tracks.</p>
              <p>Submit your plea below. If it's good enough, maybe someone will let you in.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="name">Name</label>
                <input 
                  type="text" 
                  id="name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onInvalid={(e) => handleInvalid(e, "Forgetting something?")}
                  onInput={handleInput}
                  placeholder="Who are you again?"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="phone">Phone Number</label>
                <input 
                  type="tel" 
                  id="phone" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onInvalid={(e) => handleInvalid(e, "Pleaseeeee, I want to send you good morning texts.")}
                  onInput={handleInput}
                  placeholder="So we can call you (we won't)"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="excuse">The Plea</label>
                <div className="textarea-wrapper">
                  <textarea 
                    id="excuse" 
                    value={excuse}
                    onChange={(e) => setExcuse(e.target.value)}
                    onInvalid={(e) => handleInvalid(e, "Almost there...")}
                    onInput={handleInput}
                    rows={4}
                    required
                  />
                  {!excuse && (
                    <div className="textarea-placeholder">
                      Why can't you follow the theme?<br /><br />Beg. Convincingly. And quickly.
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Plead Your Case'}
              </button>
            </form>
          </>
        )}
      </main>
      
      <footer>
        <p>NO GUARANTEES. NO REFUNDS ON DIGNITY.</p>
      </footer>
    </div>
  )
}

export default App
