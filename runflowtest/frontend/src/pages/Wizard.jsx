import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/wizard.css'

export default function Wizard() {
  const [step, setStep] = useState(1)
  const [projectData, setProjectData] = useState({
    name: '',
    problemStatement: '',
    persona: null,
    workflowType: 'text',
    workflowData: ''
  })
  const navigate = useNavigate()

  function handleNext() {
    if (step < 5) setStep(step + 1)
    else {
      // Submit and start simulation
      console.log('Starting simulation with:', projectData)
      // TODO: Call API to create project and start simulation
      navigate('/app/report/1')
    }
  }

  function handleBack() {
    if (step > 1) setStep(step - 1)
    else navigate('/app/dashboard')
  }

  return (
    <div className="wizard">
      <header className="wizard-header">
        <button onClick={() => navigate('/app/dashboard')} className="btn-back">← Back to Dashboard</button>
        <h1>Test Setup Wizard</h1>
      </header>

      <main className="wizard-content">
        <div className="step-indicator">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`step ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}>
              {s}
            </div>
          ))}
        </div>

        <div className="step-content">
          {step === 1 && (
            <div className="step-panel">
              <h2>What's your project called?</h2>
              <input
                type="text"
                placeholder="e.g. Clinic booking app"
                value={projectData.name}
                onChange={e => setProjectData({...projectData, name: e.target.value})}
              />
            </div>
          )}

          {step === 2 && (
            <div className="step-panel">
              <h2>What problem are you solving?</h2>
              <textarea
                placeholder="Describe the user goal or issue you're testing"
                value={projectData.problemStatement}
                onChange={e => setProjectData({...projectData, problemStatement: e.target.value})}
              />
            </div>
          )}

          {step === 3 && (
            <div className="step-panel">
              <h2>Who are you testing with?</h2>
              <div className="persona-options">
                {['Cautious first-timer', 'Time-pressed manager', 'Domain expert'].map(p => (
                  <label key={p}>
                    <input
                      type="radio"
                      name="persona"
                      value={p}
                      checked={projectData.persona === p}
                      onChange={e => setProjectData({...projectData, persona: e.target.value})}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="step-panel">
              <h2>Enter the workflow</h2>
              <div className="workflow-options">
                <label>
                  <input
                    type="radio"
                    value="text"
                    checked={projectData.workflowType === 'text'}
                    onChange={e => setProjectData({...projectData, workflowType: e.target.value})}
                  />
                  Describe in text
                </label>
              </div>
              <textarea
                placeholder="Screen 1: Home page with button..."
                value={projectData.workflowData}
                onChange={e => setProjectData({...projectData, workflowData: e.target.value})}
              />
            </div>
          )}

          {step === 5 && (
            <div className="step-panel">
              <h2>Ready to test?</h2>
              <div className="review-card">
                <p><strong>Project:</strong> {projectData.name}</p>
                <p><strong>Persona:</strong> {projectData.persona}</p>
                <p><strong>Problem:</strong> {projectData.problemStatement}</p>
              </div>
            </div>
          )}
        </div>

        <div className="wizard-buttons">
          <button onClick={handleBack} className="btn-secondary">← Back</button>
          <button onClick={handleNext} className="btn-primary">
            {step === 5 ? 'Start Simulation →' : 'Next →'}
          </button>
        </div>
      </main>
    </div>
  )
}
