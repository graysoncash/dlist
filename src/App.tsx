import { useState } from 'react'
import './App.css'

function App() {
  const [name, setName] = useState('')
  const [excuse, setExcuse] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Fire off the plea into the void (backend) without making the user wait
    fetch('/api/submit-plea', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, excuse }),
    }).catch((err) => {
      // If it fails, does it really matter? The vibe is "we don't care".
      console.error('Plea submission failed:', err)
    })

    console.log('Submission:', { name, excuse })
    alert("We've received your plea. Don't hold your breath.")
    setName('')
    setExcuse('')
  }

  return (
    <div className="container">
      <header>
        <h1>D-List Access</h1>
        <p className="subtitle">BEAUTIFUL. DIRTY. RICH.</p>
      </header>

      <main>
        <div className="judgment-zone">
          <p>You didn't follow the theme. That tracks.</p>
          <p>Submit your excuse below. If it's good enough, maybe someone will let you in.</p>
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
      </main>
      
      <footer>
        <p>NO GUARANTEES. NO REFUNDS ON DIGNITY.</p>
      </footer>
    </div>
  )
}

export default App
