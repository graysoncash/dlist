import { useState } from 'react'
import './App.css'

function App() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [excuse, setExcuse] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      excuse: excuse.trim()
    }

    // Fire off the plea into the void (backend) without making the user wait
    fetch('/api/submit-plea', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      // If it fails, does it really matter? The vibe is "we don't care".
      console.error('Plea submission failed:', err)
    })

    console.log('Submission:', payload)
    setSubmitted(true)
    setName('')
    setPhone('')
    setExcuse('')
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
                  placeholder="So we can call you (we won't)"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="excuse">The Plea</label>
                <textarea 
                  id="excuse" 
                  value={excuse}
                  onChange={(e) => setExcuse(e.target.value)}
                  placeholder="Beg. Convincingly. And quickly."
                  rows={4}
                  required
                />
              </div>

              <button type="submit">Plead Your Case</button>
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
