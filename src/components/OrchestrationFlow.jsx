import React, { useState } from 'react';
import SwarmHQ from './SwarmHQ';

// A lightweight, safe regex-based markdown formatter for premium text presentation
function MarkdownRenderer({ text }) {
  if (!text) return null;

  // Split content by code blocks first
  const parts = text.split(/(```[a-z]*\n[\s\S]*?\n```)/g);

  return (
    <div className="markdown-body">
      {parts.map((part, idx) => {
        if (part.startsWith('```')) {
          // It's a code block
          const lines = part.split('\n');
          const lang = lines[0].replace('```', '').trim() || 'code';
          const codeContent = lines.slice(1, -1).join('\n');
          return (
            <pre key={idx} style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '12px',
                fontSize: '0.65rem',
                color: 'var(--text-dark)',
                textTransform: 'uppercase',
                fontWeight: '700'
              }}>{lang}</span>
              <code>{codeContent}</code>
            </pre>
          );
        }

        // It's normal text, format headings, list items, bold
        const subLines = part.split('\n');
        return subLines.map((line, lIdx) => {
          let content = line;
          
          // Headings
          if (content.startsWith('### ')) {
            return <h3 key={`${idx}-${lIdx}`}>{content.replace('### ', '')}</h3>;
          }
          if (content.startsWith('## ')) {
            return <h2 key={`${idx}-${lIdx}`}>{content.replace('## ', '')}</h2>;
          }
          if (content.startsWith('# ')) {
            return <h1 key={`${idx}-${lIdx}`}>{content.replace('# ', '')}</h1>;
          }

          // Bullet lists
          if (content.startsWith('- ') || content.startsWith('* ')) {
            const listText = content.replace(/^[-*]\s+/, '');
            return (
              <ul key={`${idx}-${lIdx}`} style={{ marginLeft: '20px', marginBottom: '8px' }}>
                <li>{formatInline(listText)}</li>
              </ul>
            );
          }

          // Empty line
          if (content.trim() === '') {
            return <div key={`${idx}-${lIdx}`} style={{ height: '12px' }}></div>;
          }

          return <p key={`${idx}-${lIdx}`}>{formatInline(content)}</p>;
        });
      })}
    </div>
  );
}

// Inline formatting (bold, code tags)
function formatInline(text) {
  // Bold: **text**
  // Code: `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ 
        background: 'rgba(255,255,255,0.08)', 
        padding: '2px 4px', 
        borderRadius: '4px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.85em'
      }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// Helper to extract file deliverables from LLM outputs
function extractDeliverables(steps, finalResponse) {
  const deliverables = [];
  const seenNames = new Set();

  const addDeliverable = (name, content, language) => {
    if (!name || seenNames.has(name)) return;
    seenNames.add(name);
    deliverables.push({ name, content, language });
  };

  if (finalResponse) {
    scanTextForCodeBlocks(finalResponse, addDeliverable);
  }

  if (steps) {
    steps.forEach(step => {
      if (step.output) {
        scanTextForCodeBlocks(step.output, addDeliverable);
      }
    });
  }

  return deliverables;
}

function scanTextForCodeBlocks(text, addDeliverable) {
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const lang = (match[1] || 'text').toLowerCase();
    const content = match[2];
    
    let filename = '';
    const lines = content.split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      const secondLine = lines.length > 1 ? lines[1].trim() : '';
      
      const fileMatch = firstLine.match(/^(?:#|\/\/|\/\*|<!--)\s*([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/) ||
                        secondLine.match(/^(?:#|\/\/|\/\*|<!--)\s*([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/);
      if (fileMatch) {
        filename = fileMatch[1].trim();
      }
    }

    if (!filename) {
      if (lang === 'python' || lang === 'py') filename = 'green_curry_scraper.py';
      else if (lang === 'markdown' || lang === 'md') filename = 'green_curry_recipe.md';
      else if (lang === 'html') filename = 'index.html';
      else if (lang === 'javascript' || lang === 'js') filename = 'app.js';
      else if (lang === 'css') filename = 'styles.css';
      else if (lang === 'json') filename = 'data.json';
      else if (lang === 'requirements' || content.includes('==')) filename = 'requirements.txt';
      else continue; // Skip generic code blocks without clear targets
    }

    addDeliverable(filename, content, lang);
  }
}

export default function OrchestrationFlow({ 
  agents, 
  ceoModel, 
  onRunOrchestration, 
  onResumeOrchestration,
  isRunning, 
  steps, 
  ceoStep, 
  finalResponse,
  error
}) {
  const [taskInput, setTaskInput] = useState('');
  const [expandedSteps, setExpandedSteps] = useState({});
  const [previewUrl, setPreviewUrl] = useState(null);

  const toggleExpand = (index) => {
    setExpandedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleStart = () => {
    if (!taskInput.trim()) {
      alert('Please enter a task or goal.');
      return;
    }
    setExpandedSteps({});
    onRunOrchestration(taskInput);
  };

  // Extract files dynamically from generated outputs
  const deliverables = extractDeliverables(steps, finalResponse);

  // Trigger file download to local machine
  const downloadFile = (file) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Launch live browser preview for HTML deliverables
  const previewApp = (file) => {
    const blob = new Blob([file.content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
  };

  // Calculate Progress Stats
  const totalStepsCount = steps.length;
  const completedStepsCount = steps.filter(s => s.status === 'completed').length;
  const runningStep = steps.find(s => s.status === 'running');
  const progressPercent = totalStepsCount > 0 ? Math.round((completedStepsCount / totalStepsCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Task Input Section */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Input Goal / Assign Work to Agent Group</span>
            <span style={{ textTransform: 'none', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
              CEO Model: {ceoModel.split('/').pop()}
            </span>
          </label>
          <textarea
            rows="3"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            disabled={isRunning}
            placeholder="Describe your goal in detail (e.g. 'Write a recipe for green curry and write a python script to scrape the ingredients online')"
            style={{ fontSize: '1rem', lineHeight: '1.5' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {steps && steps.length > 0 && (
            <button
              onClick={() => onResumeOrchestration(taskInput)}
              disabled={isRunning || !taskInput.trim()}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #e11d48)',
                color: 'white',
                border: 'none',
                fontWeight: '600'
              }}
            >
              {isRunning ? (
                <>
                  <span className="spinner"></span>
                  Resuming...
                </>
              ) : 'Resume Group Work'}
            </button>
          )}
          <button 
            onClick={handleStart} 
            className="btn btn-primary"
            disabled={isRunning || !taskInput.trim()}
          >
            {isRunning ? (
              <>
                <span className="spinner"></span>
                Processing Group Tasks...
              </>
            ) : 'Launch AI Group'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ borderLeft: '4px solid var(--error)', padding: '16px', background: 'rgba(239, 68, 68, 0.08)' }}>
          <h4 style={{ color: 'var(--error)', marginBottom: '4px', fontWeight: '600' }}>Orchestration Error</h4>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{error}</p>
        </div>
      )}

      {/* Execution Board */}
      {(ceoStep || steps.length > 0 || finalResponse) && (
        <div className="glass-panel slide-in" style={{ padding: '24px' }}>
          
          {/* Progress Status Dashboard */}
          {isRunning && (
            <div className="status-dashboard glass-panel fade-in" style={{
              background: 'rgba(99, 102, 241, 0.04)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              padding: '18px 24px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Radial gradient background pulse */}
              <div className="pulse-glow" style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
                animation: 'pulse 2s infinite alternate',
                pointerEvents: 'none'
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Active Swarm Progress
                  </span>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', marginTop: '2px' }}>
                    {runningStep 
                      ? `Active: ${agents.find(a => a.id === runningStep.assignedAgentId)?.name || 'Agent'} — ${runningStep.title}`
                      : ceoStep?.status === 'running' 
                        ? 'Coordinating requirements and drafting roadmap...'
                        : 'Consolidating outputs and final delivery...'}
                  </h4>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{progressPercent}%</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{completedStepsCount} of {totalStepsCount} steps</div>
                </div>
              </div>

              {/* Glowing progress line */}
              <div style={{ 
                width: '100%', 
                height: '6px', 
                background: 'rgba(255,255,255,0.06)', 
                borderRadius: '3px',
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                  borderRadius: '3px',
                  transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }} />
              </div>
            </div>
          )}

          {/* Premium Animated Virtual Office */}
          <SwarmHQ agents={agents} steps={steps} ceoStep={ceoStep} isRunning={isRunning} />

          {/* Project Deliverables Download center */}
          {deliverables.length > 0 && (
            <div className="deliverables-section fade-in" style={{
              marginBottom: '28px',
              paddingBottom: '24px',
              borderBottom: '1px solid var(--border)'
            }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '750', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '1px' }}>
                📦 Project Deliverables & Artifacts ({deliverables.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {deliverables.map((file, idx) => {
                  let fileIcon = '📄';
                  
                  if (file.name.endsWith('.py')) {
                    fileIcon = '🐍';
                  } else if (file.name.endsWith('.md')) {
                    fileIcon = '📝';
                  } else if (file.name.endsWith('.html')) {
                    fileIcon = '🌐';
                  } else if (file.name.endsWith('.js')) {
                    fileIcon = '⚡';
                  } else if (file.name.endsWith('.css')) {
                    fileIcon = '🎨';
                  } else if (file.name.endsWith('.txt')) {
                    fileIcon = '⚙️';
                  } else if (file.name.endsWith('.json')) {
                    fileIcon = '🗂️';
                  }

                  const sizeKB = (new Blob([file.content]).size / 1024).toFixed(1);

                  return (
                    <div key={idx} className="glass-panel hover-card" style={{
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      <div style={{
                        fontSize: '1.6rem',
                        width: '44px',
                        height: '44px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        {fileIcon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h5 style={{
                          fontSize: '0.88rem',
                          fontWeight: '600',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={file.name}>
                          {file.name}
                        </h5>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>
                          {sizeKB} KB • {file.language}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {file.name.endsWith('.html') && (
                          <button
                            onClick={() => previewApp(file)}
                            className="btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                              border: 'none',
                              color: 'white',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            Preview
                          </button>
                        )}
                        <button
                          onClick={() => downloadFile(file)}
                          className="btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-main)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h3 style={{ fontSize: '1rem', fontWeight: '650', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Collaboration Timeline
          </h3>

          <div className="timeline">
            
            {/* CEO Planning Step */}
            {ceoStep && (
              <div className="timeline-step">
                <div className="timeline-marker">
                  <div className={`timeline-dot ${
                    ceoStep.status === 'running' ? 'active' : 
                    ceoStep.status === 'completed' ? 'completed' : 'error'
                  }`} />
                  <div className="timeline-line" />
                </div>
                <div className="timeline-content">
                  <div className={`timeline-card ${ceoStep.status === 'running' ? 'active' : ''}`}>
                    <div className="timeline-card-header">
                      <div className="timeline-agent-info">
                        <span className="agent-badge ceo">CEO</span>
                        <span className="timeline-agent-name">Group Leader</span>
                      </div>
                      <span className="timeline-status">
                        {ceoStep.status === 'running' ? 'Analyzing & Planning' : 'Planning Done'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{ceoStep.statusText}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Agent Execution Steps */}
            {steps.map((step, idx) => {
              const agent = agents.find(a => a.id === step.assignedAgentId) || { name: 'Agent', role: 'Helper' };
              const isExpanded = expandedSteps[idx] ?? (step.status === 'running' || step.status === 'error');
              
              return (
                <div key={idx} className="timeline-step">
                  <div className="timeline-marker">
                    <div className={`timeline-dot ${
                      step.status === 'running' ? 'active' :
                      step.status === 'completed' ? 'completed' :
                      step.status === 'error' ? 'error' : ''
                    }`} />
                    <div className="timeline-line" />
                  </div>
                  <div className="timeline-content">
                    <div className={`timeline-card ${step.status === 'running' ? 'active' : ''}`}>
                      <div 
                        className="timeline-card-header" 
                        onClick={() => step.status !== 'idle' && toggleExpand(idx)}
                        style={{ cursor: step.status !== 'idle' ? 'pointer' : 'default' }}
                      >
                        <div className="timeline-agent-info">
                          <span className="agent-badge sub">{agent.role}</span>
                          <span className="timeline-agent-name">{agent.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>— {step.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="timeline-status" style={{ fontSize: '0.8rem' }}>
                            {step.status === 'idle' && 'Waiting...'}
                            {step.status === 'running' && 'Executing task...'}
                            {step.status === 'completed' && 'Completed'}
                            {step.status === 'error' && 'Execution Failed'}
                          </span>
                          {step.status !== 'idle' && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded && step.status !== 'idle' && (
                        <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: '600', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                              Task Instructions
                            </label>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              {step.description}
                            </p>
                          </div>
                          
                          {step.status === 'running' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '0.85rem' }}>
                              <span className="spinner"></span>
                              Running model query...
                            </div>
                          )}

                          {step.output && (
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: '600', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                                Output Response
                              </label>
                              <div className="timeline-output">
                                <MarkdownRenderer text={step.output} />
                              </div>
                            </div>
                          )}

                          {step.error && (
                            <div style={{ color: 'var(--error)', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                              <strong>Error:</strong> {step.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* CEO Final Synthesis Step */}
            {finalResponse && (
              <div className="timeline-step">
                <div className="timeline-marker">
                  <div className="timeline-dot completed" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-card" style={{ borderLeft: '4px solid var(--success)', background: 'rgba(16, 185, 129, 0.03)' }}>
                    <div className="timeline-card-header" style={{ marginBottom: '16px' }}>
                      <div className="timeline-agent-info">
                        <span className="agent-badge ceo">CEO</span>
                        <span className="timeline-agent-name">Group Leader</span>
                      </div>
                      <span className="timeline-status" style={{ color: 'var(--success)', fontWeight: '600' }}>
                        Final Aggregated Output
                      </span>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                      <MarkdownRenderer text={finalResponse} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <button 
                        className="btn" 
                        onClick={() => {
                          navigator.clipboard.writeText(finalResponse);
                          alert('Copied to clipboard!');
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Copy Output
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {previewUrl && (
        <div className="modal-overlay" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}>
          <div className="glass-panel slide-in" style={{
            width: '90%',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '16px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                🌐 Live App Sandbox Preview
              </h4>
              <button className="btn" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
                Close Preview
              </button>
            </div>
            <iframe 
              src={previewUrl} 
              title="Live App Sandbox Preview"
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'white'
              }}
              sandbox="allow-scripts"
            />
          </div>
        </div>
      )}

    </div>
  );
}
