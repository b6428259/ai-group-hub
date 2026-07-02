import React, { useState } from 'react';

const AGENT_TEMPLATES = [
  {
    name: 'Software Developer',
    role: 'Coder',
    systemPrompt: 'You are an expert software developer. Write clean, modular, and well-documented code. Always specify language tags in your markdown code blocks. Explain your design decisions briefly and list any assumptions.',
    temperature: 0.2,
  },
  {
    name: 'Copywriter',
    role: 'Writer',
    systemPrompt: 'You are a professional copywriter and content strategist. Write engaging, persuasive, and grammatically correct articles, product descriptions, or documents tailored to the user\'s target audience. Use structured headings and clear paragraphs.',
    temperature: 0.7,
  },
  {
    name: 'Technical QA & Editor',
    role: 'Reviewer',
    systemPrompt: 'You are a meticulous quality assurance engineer and senior technical editor. Critically review previous outputs for bugs, logical flaws, syntax errors, clarity, tone, and formatting issues. Provide clear feedback and write-ups of corrections.',
    temperature: 0.1,
  },
  {
    name: 'UI/UX Designer',
    role: 'Designer',
    systemPrompt: 'You are a creative UI/UX architect and designer. Plan aesthetic interfaces, map user journeys, write structured layouts, and define modern CSS/styling systems. Provide visual descriptions and complete HTML/CSS mockups where appropriate.',
    temperature: 0.6,
  }
];

export default function AgentManager({ agents, onUpdateAgents, models }) {
  const [editingAgent, setEditingAgent] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formTemp, setFormTemp] = useState(0.5);
  const [formReasoningEffort, setFormReasoningEffort] = useState('');

  const startEdit = (agent) => {
    setIsNew(false);
    setEditingAgent(agent);
    setFormId(agent.id);
    setFormName(agent.name);
    setFormRole(agent.role);
    setFormPrompt(agent.systemPrompt);
    setFormModel(agent.model || (models.length > 0 ? models[0].key : ''));
    setFormTemp(agent.temperature ?? 0.5);
    setFormReasoningEffort(agent.reasoningEffort || '');
    setShowModal(true);
  };

  const startNew = () => {
    setIsNew(true);
    setEditingAgent(null);
    setFormId(`agent_${Date.now()}`);
    setFormName('');
    setFormRole('');
    setFormPrompt('');
    setFormModel(models.length > 0 ? models[0].key : '');
    setFormTemp(0.5);
    setFormReasoningEffort('');
    setShowModal(true);
  };

  const applyTemplate = (template) => {
    setFormName(template.name);
    setFormRole(template.role);
    setFormPrompt(template.systemPrompt);
    setFormTemp(template.temperature);
    setFormReasoningEffort('');
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formName.trim() || !formRole.trim() || !formPrompt.trim()) {
      alert('Please fill out all fields.');
      return;
    }

    let updated;
    if (isNew) {
      const newAgent = {
        id: formId,
        name: formName,
        role: formRole,
        systemPrompt: formPrompt,
        model: formModel,
        temperature: parseFloat(formTemp),
        reasoningEffort: formReasoningEffort,
        active: true
      };
      updated = [...agents, newAgent];
    } else {
      updated = agents.map(a => a.id === formId ? {
        ...a,
        name: formName,
        role: formRole,
        systemPrompt: formPrompt,
        model: formModel,
        temperature: parseFloat(formTemp),
        reasoningEffort: formReasoningEffort
      } : a);
    }

    onUpdateAgents(updated);
    setShowModal(false);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      const updated = agents.filter(a => a.id !== id);
      onUpdateAgents(updated);
      setShowModal(false);
    }
  };

  const toggleActive = (id, e) => {
    e.stopPropagation(); // prevent opening edit modal
    const updated = agents.map(a => a.id === id ? { ...a, active: !a.active } : a);
    onUpdateAgents(updated);
  };

  const handleCloneAgent = (agent, e) => {
    e.stopPropagation(); // prevent opening edit modal
    const existingSameRole = agents.filter(a => a.role === agent.role);
    const nextNumber = existingSameRole.length + 1;
    const newAgent = {
      ...agent,
      id: `${agent.id}_clone_${Date.now()}`,
      name: `${agent.name.replace(/\s\d+$/, '')} ${nextNumber}`,
      active: true,
      isHired: false
    };
    const updated = [...agents, newAgent];
    onUpdateAgents(updated);
  };

  return (
    <div className="agent-manager-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Agents Group</h3>
        <button 
          onClick={startNew} 
          className="btn" 
          style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
        >
          + Add Agent
        </button>
      </div>

      <div className="agent-list">
        {agents.map((agent) => (
          <div 
            key={agent.id} 
            className={`agent-card ${agent.active ? '' : 'inactive'}`} 
            onClick={() => startEdit(agent)}
            style={{ 
              opacity: agent.active ? 1 : 0.55,
              borderLeft: agent.isHired ? '3px solid var(--success)' : undefined
            }}
          >
            <div className="agent-card-header">
              <span className="agent-name">
                {agent.name}
                {agent.isHired && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: '600', marginLeft: '6px', verticalAlign: 'middle', padding: '1px 4px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.1)' }}>
                    Hired
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`agent-badge ${agent.id === 'ceo' ? 'ceo' : 'sub'}`}>
                  {agent.role}
                </span>
                {agent.id !== 'ceo' && (
                  <>
                    <button
                      title="Clone / Scale Agent"
                      onClick={(e) => handleCloneAgent(agent, e)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.65rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        marginRight: '4px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'var(--primary)';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.target.style.color = 'var(--text-muted)';
                      }}
                    >
                      Clone
                    </button>
                    <input 
                      type="checkbox" 
                      checked={agent.active} 
                      onChange={(e) => toggleActive(agent.id, e)}
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              <div className="agent-model-tag" title={agent.model}>
                {agent.model ? agent.model.split('/').pop() : 'OpenClaw Default'}
              </div>
              {agent.reasoningEffort && (
                <div style={{
                  fontSize: '0.6rem',
                  fontWeight: '850',
                  color: 'var(--accent)',
                  background: 'rgba(99, 102, 241, 0.08)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  🧠 {agent.reasoningEffort.toUpperCase()}
                </div>
              )}
            </div>

            {/* Gamified stats */}
            {agent.active && (
              <div className="agent-stats-row" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                fontSize: '0.65rem',
                color: 'var(--text-dark)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    color: 'var(--accent)', 
                    padding: '2px 4px', 
                    borderRadius: '3px',
                    fontWeight: '700'
                  }}>
                    LV {agent.level || 1}
                  </span>
                  <span>XP: {agent.xp || 0}/100</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚡ {agent.energy !== undefined ? agent.energy : 100}%</span>
                    <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${agent.energy !== undefined ? agent.energy : 100}%`,
                        height: '100%',
                        background: (agent.energy !== undefined ? agent.energy : 100) > 40 ? 'var(--success)' : '#ef4444',
                        borderRadius: '2px',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                  <span title={`Mood: ${agent.mood || 'idle'}`} style={{ fontSize: '0.8rem' }}>
                    {agent.mood === 'working' ? '💼' :
                     agent.mood === 'proud' ? '😎' :
                     agent.mood === 'stressed' ? '😰' :
                     agent.mood === 'frustrated' ? '😡' :
                     agent.mood === 'tired' ? '😴' : '💤'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel slide-in">
            <h2 style={{ marginBottom: '20px', fontSize: '1.4rem' }}>
              {isNew ? 'Create Agent' : 'Edit Agent Parameters'}
            </h2>

            {isNew && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dark)', marginBottom: '8px', textTransform: 'uppercase' }}>Quick Templates</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {AGENT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.role}
                      type="button"
                      className="btn"
                      onClick={() => applyTemplate(tmpl)}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                    >
                      {tmpl.role}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Agent Name</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  placeholder="e.g., Senior Developer"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Role Badge</label>
                <input 
                  type="text" 
                  value={formRole} 
                  onChange={(e) => setFormRole(e.target.value)} 
                  placeholder="e.g., Coder"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Model</label>
                <select value={formModel} onChange={(e) => setFormModel(e.target.value)}>
                  {models.map(model => (
                    <option key={model.key} value={model.key}>
                      {model.name || model.key}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reasoning / Thinking Level Configuration */}
              {(() => {
                const selectedModelMeta = models.find(m => m.key === formModel);
                const hasReasoning = selectedModelMeta?.reasoning;
                const supportedEfforts = selectedModelMeta?.compat?.supportedReasoningEfforts || ['low', 'medium', 'high'];
                
                if (!hasReasoning) return null;

                return (
                  <div className="form-group" style={{ 
                    background: 'rgba(99, 102, 241, 0.04)', 
                    border: '1px solid rgba(99, 102, 241, 0.12)', 
                    padding: '12px', 
                    borderRadius: '6px',
                    marginTop: '8px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: '700' }}>
                      🧠 Thinking Level (Reasoning Effort)
                    </label>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-dark)', marginBottom: '8px' }}>
                      Configure the cognitive depth and response analysis effort for this model.
                    </p>
                    <select 
                      value={formReasoningEffort} 
                      onChange={(e) => setFormReasoningEffort(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', borderRadius: '4px' }}
                    >
                      <option value="">Default (Auto / Managed)</option>
                      {supportedEfforts.map(effort => (
                        <option key={effort} value={effort}>
                          {effort.toUpperCase()} ({effort === 'low' ? 'Fast & Brief' : effort === 'medium' ? 'Balanced' : 'Deep & Thorough'})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div className="form-group">
                <div style={{ display: 'flex', justifycontent: 'space-between' }}>
                  <label>Temperature</label>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{formTemp}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={formTemp} 
                  onChange={(e) => setFormTemp(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>System Instructions (Persona)</label>
                <textarea 
                  rows="4" 
                  value={formPrompt} 
                  onChange={(e) => setFormPrompt(e.target.value)} 
                  placeholder="Describe how this agent behaves, its expertise, limits, and rules..."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div>
                  {(!isNew && formId !== 'ceo') && (
                    <button 
                      type="button" 
                      onClick={() => handleDelete(formId)} 
                      className="btn btn-danger"
                    >
                      Delete Agent
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {isNew ? 'Create' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
