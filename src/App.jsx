import React, { useState, useEffect, useRef } from 'react';
import { fetchModels, runInference } from './services/api';
import { runOrchestration } from './services/orchestrator';
import AgentManager from './components/AgentManager';
import OrchestrationFlow from './components/OrchestrationFlow';

const DEFAULT_AGENTS = [
  {
    id: 'secretary',
    name: 'Secretary (Board)',
    role: 'Secretary',
    systemPrompt: 'You are the Executive Secretary of the Board. Your role is to gather requirements from the user, compile meeting minutes, summarize results, and propose structured goals to the CEO.',
    model: 'sut-openwebui/openrouter/auto',
    temperature: 0.5,
    active: true
  },
  {
    id: 'ceo',
    name: 'Chief Executive Officer',
    role: 'CEO',
    systemPrompt: 'You are the Chief Executive Officer. You set high-level strategic directives, approve proposals, and delegate major departmental milestones to Chief Directors.',
    model: 'sut-openwebui/openrouter/auto',
    temperature: 0.5,
    active: true
  },
  {
    id: 'cto',
    name: 'Chief Director (CTO)',
    role: 'CTO',
    systemPrompt: 'You are the Chief Technology Officer. Your role is to take high-level objectives from the CEO, define technical specifications/architectures, and delegate projects to managers.',
    model: 'sut-openwebui/openrouter/auto',
    temperature: 0.3,
    active: true
  },
  {
    id: 'pm',
    name: 'Vice Director (Product)',
    role: 'PM',
    systemPrompt: 'You are the Vice President of Product. Your role is to coordinate execution timelines, define concrete sub-tasks, and manage work schedules for subordinate specialists.',
    model: 'sut-openwebui/openrouter/auto',
    temperature: 0.5,
    active: true
  },
  {
    id: 'coder',
    name: 'Subordinate (Developer)',
    role: 'Coder',
    systemPrompt: 'You are a Subordinate Specialist Software Developer. Write clean, functional code, design databases, and build python scripts based on direct tasks given by your Manager.',
    model: 'sut-openwebui/openrouter/auto',
    temperature: 0.2,
    active: true
  },
  {
    id: 'writer',
    name: 'Subordinate (Copywriter)',
    role: 'Writer',
    systemPrompt: 'You are a Subordinate Specialist Copywriter. Write engaging articles, structured documentation, and content files as requested by your Product Manager.',
    model: 'sut-openwebui/openrouter/auto',
    temperature: 0.7,
    active: true
  },
  {
    id: 'reviewer',
    name: 'Subordinate (QA Inspector)',
    role: 'Reviewer',
    systemPrompt: 'You are a Subordinate Specialist QA Inspector. Critically review scripts and recipe contents for compliance, bugs, formatting errors, and quality standards.',
    model: 'sut-openwebui/openrouter/auto',
    temperature: 0.1,
    active: true
  }
];

export default function App() {
  const AGENTS_KEY = 'openclaw_agents_v1';
  
  const [agents, setAgents] = useState(() => {
    const saved = localStorage.getItem(AGENTS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_AGENTS;
  });
  
  const [models, setModels] = useState([]);
  const [overallModel, setOverallModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [activeTab, setActiveTab] = useState('workspace');
  
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [ceoStep, setCeoStep] = useState(null);
  const [finalResponse, setFinalResponse] = useState('');
  const [error, setError] = useState(null);

  const handleOverallModelChange = (modelKey) => {
    setOverallModel(modelKey);
    if (!modelKey) return;
    setAgents(prev => prev.map(a => ({ ...a, model: modelKey })));
  };

  const [selectedAgentId, setSelectedAgentId] = useState('ceo');
  const [sandboxMessages, setSandboxMessages] = useState([]);
  const [sandboxInput, setSandboxInput] = useState('');
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
  }, [agents]);

  // If local storage agents list doesn't have our new secretary/cto/pm, clear localStorage once to force corporate team
  useEffect(() => {
    if (agents.length < 5) {
      setAgents(DEFAULT_AGENTS);
      localStorage.setItem(AGENTS_KEY, JSON.stringify(DEFAULT_AGENTS));
    }
  }, []);

  useEffect(() => {
    async function loadModels() {
      try {
        const list = await fetchModels();
        setModels(list);
        
        if (list.length > 0) {
          const defaultModel = list[0].key;
          setOverallModel(defaultModel);
          setAgents(prev => prev.map(a => (!a.model || !list.some(m => m.key === a.model)) ? { ...a, model: defaultModel } : a));
        }
      } catch (err) {
        console.error('Failed to load OpenClaw models:', err);
        setModels([
          { key: 'sut-openwebui/openrouter/auto', name: 'SUT Auto Router' },
          { key: 'sut-openwebui/anthropic/claude-sonnet-4.6', name: 'SUT Claude Sonnet 4.6' },
          { key: 'sut-openwebui/google/gemini-3.1-flash-lite', name: 'SUT Gemini 3.1 Flash Lite' },
          { key: 'sut-openwebui/openrouter/pareto-code', name: 'SUT Pareto Code' }
        ]);
      } finally {
        setLoadingModels(false);
      }
    }
    loadModels();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sandboxMessages, isSandboxRunning]);

  const handleRunOrchestration = async (mainTask) => {
    setIsRunning(true);
    setError(null);
    setFinalResponse('');
    setSteps([]);
    setCeoStep({
      status: 'running',
      statusText: 'Contacting Secretary to gather details and initialize planning...'
    });

    const ceoAgent = agents.find(a => a.id === 'ceo') || DEFAULT_AGENTS[1];

    try {
      await runOrchestration({
        mainTask,
        ceoModel: ceoAgent.model,
        agents,
        onStepStart: (stepIdx, agentId, agentName, statusText) => {
          if (stepIdx === -1) {
            setCeoStep({ status: 'running', statusText });
          } else {
            setSteps(prev => {
              if (stepIdx === prev.length) {
                setCeoStep({ status: 'running', statusText: 'Consolidating outputs and writing final CEO report...' });
                return prev;
              }
              return prev.map((s, idx) => idx === stepIdx ? { ...s, status: 'running', statusText } : s);
            });
          }
        },
        onCEOPlanCreated: (plannedSteps) => {
          setCeoStep({ status: 'completed', statusText: `Meeting complete. Corporate roadmap created with ${plannedSteps.length} hierarchical stages.` });
          setSteps(plannedSteps.map(s => ({
            ...s,
            status: 'idle',
            output: '',
            error: ''
          })));
        },
        onStepOutput: (stepIdx, text) => {
          // Streaming not implemented
        },
        onStepComplete: (stepIdx, outputText) => {
          if (stepIdx === -1) {
            setCeoStep(prev => ({ ...prev, status: 'completed' }));
          } else {
            setSteps(prev => {
              if (stepIdx >= prev.length) {
                setCeoStep(prevCeo => ({ ...prevCeo, status: 'completed', statusText: 'Corporate consolidation complete.' }));
                return prev;
              }
              return prev.map((s, idx) => idx === stepIdx ? { ...s, status: 'completed', output: outputText } : s);
            });
          }
        },
        onStepError: (stepIdx, errMessage) => {
          if (stepIdx === -1) {
            setCeoStep(prev => ({ ...prev, status: 'error', statusText: `CEO Error: ${errMessage}` }));
          } else {
            setSteps(prev => {
              if (stepIdx >= prev.length) {
                setCeoStep(prevCeo => ({ ...prevCeo, status: 'error', statusText: `CEO Synthesis Error: ${errMessage}` }));
                return prev;
              }
              return prev.map((s, idx) => idx === stepIdx ? { ...s, status: 'error', error: errMessage } : s);
            });
          }
          setError(errMessage);
        },
        onFinalResponse: (resp) => {
          setFinalResponse(resp);
        },
        onAgentHired: (newAgent) => {
          setAgents(prev => {
            if (prev.some(a => a.id === newAgent.id)) return prev;
            return [...prev, newAgent];
          });
        }
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleResumeOrchestration = async (mainTask) => {
    setIsRunning(true);
    setError(null);
    setFinalResponse('');
    
    // Find the first step index that is NOT completed
    const firstIncompleteIdx = steps.findIndex(s => s.status !== 'completed');
    
    setCeoStep({
      status: 'running',
      statusText: `Resuming incomplete tasks starting from step ${firstIncompleteIdx !== -1 ? firstIncompleteIdx + 1 : 1}...`
    });

    const ceoAgent = agents.find(a => a.id === 'ceo') || DEFAULT_AGENTS[1];

    try {
      await runOrchestration({
        mainTask,
        ceoModel: ceoAgent.model,
        agents,
        existingSteps: steps,
        onStepStart: (stepIdx, agentId, agentName, statusText) => {
          if (stepIdx === -1) {
            setCeoStep({ status: 'running', statusText });
          } else {
            setSteps(prev => {
              if (stepIdx === prev.length) {
                setCeoStep({ status: 'running', statusText: 'Consolidating outputs and writing final CEO report...' });
                return prev;
              }
              return prev.map((s, idx) => idx === stepIdx ? { ...s, status: 'running', statusText } : s);
            });
          }
        },
        onCEOPlanCreated: (plannedSteps) => {
          // Will not be triggered in resume mode
        },
        onStepOutput: (stepIdx, text) => {
          // Streaming not implemented
        },
        onStepComplete: (stepIdx, outputText) => {
          if (stepIdx === -1) {
            setCeoStep(prev => ({ ...prev, status: 'completed' }));
          } else {
            setSteps(prev => {
              if (stepIdx >= prev.length) {
                setCeoStep(prevCeo => ({ ...prevCeo, status: 'completed', statusText: 'Corporate consolidation complete.' }));
                return prev;
              }
              return prev.map((s, idx) => idx === stepIdx ? { ...s, status: 'completed', output: outputText } : s);
            });
          }
        },
        onStepError: (stepIdx, errMessage) => {
          if (stepIdx === -1) {
            setCeoStep(prev => ({ ...prev, status: 'error', statusText: `CEO Error: ${errMessage}` }));
          } else {
            setSteps(prev => {
              if (stepIdx >= prev.length) {
                setCeoStep(prevCeo => ({ ...prevCeo, status: 'error', statusText: `CEO Synthesis Error: ${errMessage}` }));
                return prev;
              }
              return prev.map((s, idx) => idx === stepIdx ? { ...s, status: 'error', error: errMessage } : s);
            });
          }
          setError(errMessage);
        },
        onFinalResponse: (resp) => {
          setFinalResponse(resp);
        },
        onAgentHired: (newAgent) => {
          setAgents(prev => {
            if (prev.some(a => a.id === newAgent.id)) return prev;
            return [...prev, newAgent];
          });
        }
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSendSandbox = async () => {
    if (!sandboxInput.trim()) return;
    
    const userMsg = { role: 'user', text: sandboxInput };
    setSandboxMessages(prev => [...prev, userMsg]);
    setSandboxInput('');
    setIsSandboxRunning(true);

    const agent = agents.find(a => a.id === selectedAgentId);
    
    const historyText = sandboxMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`)
      .join('\n');

    const prompt = `[SYSTEM]
${agent.systemPrompt}

[CHAT HISTORY]
${historyText || 'None.'}

[USER]
User: ${userMsg.text}

Agent:`;

    try {
      const reply = await runInference(agent.model, prompt);
      setSandboxMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setSandboxMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err.message}` }]);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  return (
    <div className="app-container">
      
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon" />
          <h1>AI Group Hub</h1>
        </div>
        
        {loadingModels ? (
          <div style={{ color: 'var(--text-dark)', fontSize: '0.85rem' }}>
            <span className="spinner" style={{ display: 'inline-block', marginRight: '6px' }}></span>
            Connecting to OpenClaw...
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.15)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
            OpenClaw Gateway Online
          </div>
        )}

        <AgentManager 
          agents={agents} 
          onUpdateAgents={setAgents} 
          models={models} 
        />
      </aside>

      <main className="workspace">
        
        <header className="workspace-header">
          <div className="tab-nav">
            <button 
              className={`tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
              onClick={() => setActiveTab('workspace')}
            >
              Group Workspace
            </button>
            <button 
              className={`tab-btn ${activeTab === 'sandbox' ? 'active' : ''}`}
              onClick={() => setActiveTab('sandbox')}
            >
              Agent Sandbox
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: '600' }}>Overall Model:</label>
              <select
                value={overallModel}
                onChange={(e) => handleOverallModelChange(e.target.value)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="">-- Choose Global Model --</option>
                {models.map(m => (
                  <option key={m.key} value={m.key}>{m.name}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>
              Configured Models: <span style={{ color: 'var(--text-muted)' }}>{models.length}</span>
            </div>
          </div>
        </header>

        <section className="workspace-content">
          
          {activeTab === 'workspace' && (
            <OrchestrationFlow 
              agents={agents}
              ceoModel={agents.find(a => a.id === 'ceo')?.model || 'sut-openwebui/openrouter/auto'}
              onRunOrchestration={handleRunOrchestration}
              onResumeOrchestration={handleResumeOrchestration}
              isRunning={isRunning}
              steps={steps}
              ceoStep={ceoStep}
              finalResponse={finalResponse}
              error={error}
            />
          )}

          {activeTab === 'sandbox' && (
            <div className="chat-window fade-in">
              <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chatting with:</label>
                  <select 
                    value={selectedAgentId} 
                    onChange={(e) => {
                      setSelectedAgentId(e.target.value);
                      setSandboxMessages([]);
                    }}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)' }}
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role}){a.isHired ? ' 👤 (Hired)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => setSandboxMessages([])} 
                  className="btn"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  Clear History
                </button>
              </div>

              <div className="chat-messages glass-panel" style={{ padding: '24px', flex: 1 }}>
                {sandboxMessages.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-dark)', gap: '8px' }}>
                    <span>No messages yet.</span>
                    <span style={{ fontSize: '0.8rem', textAlign: 'center', maxWidth: '300px' }}>
                      Ask "{selectedAgent.name}" a question to test its system instructions.
                    </span>
                  </div>
                ) : (
                  sandboxMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role}`}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: msg.role === 'user' ? 'var(--accent)' : 'var(--primary)', textTransform: 'uppercase' }}>
                        {msg.role === 'user' ? 'You' : selectedAgent.name}
                      </span>
                      <p style={{ fontSize: '0.92rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{msg.text}</p>
                    </div>
                  ))
                )}
                {isSandboxRunning && (
                  <div className="chat-bubble assistant">
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase' }}>
                      {selectedAgent.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark)', fontSize: '0.9rem', marginTop: '4px' }}>
                      <span className="spinner"></span>
                      thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-area">
                <textarea
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendSandbox();
                    }
                  }}
                  disabled={isSandboxRunning}
                  placeholder={`Ask ${selectedAgent.name} something... (Press Enter to send)`}
                />
                <button 
                  onClick={handleSendSandbox} 
                  className="btn btn-primary"
                  style={{ height: '46px', padding: '0 24px' }}
                  disabled={isSandboxRunning || !sandboxInput.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          )}

        </section>
      </main>

    </div>
  );
}
