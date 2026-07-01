import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Department Layout Config ───────────────────────────────
const DEPARTMENTS = [
  { id: 'exec',  label: 'Executive Suite',  icon: '🏛️', gridCol: 1, gridRow: 1, color: '#f59e0b' },
  { id: 'tech',  label: 'Tech Lab',         icon: '⚡', gridCol: 3, gridRow: 1, color: '#6366f1' },
  { id: 'dev',   label: 'Dev Workspace',     icon: '💻', gridCol: 1, gridRow: 2, color: '#10b981' },
  { id: 'write', label: 'Copywriting Hub',   icon: '✍️', gridCol: 3, gridRow: 2, color: '#ec4899' },
];

// Map agent roles → department + home position (% based)
const ROLE_HOME = {
  Secretary: { dept: 'exec',  x: 14, y: 25 },
  CEO:       { dept: 'exec',  x: 24, y: 30 },
  CTO:       { dept: 'tech',  x: 76, y: 25 },
  PM:        { dept: 'tech',  x: 80, y: 35 },
  Coder:     { dept: 'dev',   x: 14, y: 70 },
  Writer:    { dept: 'write', x: 76, y: 70 },
  Reviewer:  { dept: 'dev',   x: 24, y: 75 },
};

const CENTER = { x: 47, y: 47 };

// Role → avatar gradient pairs
const ROLE_GRADIENTS = {
  Secretary: ['#fbbf24', '#f59e0b'],
  CEO:       ['#a78bfa', '#7c3aed'],
  CTO:       ['#60a5fa', '#3b82f6'],
  PM:        ['#34d399', '#059669'],
  Coder:     ['#38bdf8', '#0284c7'],
  Writer:    ['#f472b6', '#db2777'],
  Reviewer:  ['#fb923c', '#ea580c'],
};

const ROLE_EMOJI = {
  Secretary: '👩‍💼',
  CEO:       '👑',
  CTO:       '🧠',
  PM:        '📋',
  Coder:     '⚙️',
  Writer:    '📝',
  Reviewer:  '🔍',
};

// ─── Typing Speech Bubble ───────────────────────────────────
function TypingSpeechBubble({ text }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    const maxLen = Math.min(text.length, 40);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i) + (i < maxLen ? '▎' : ''));
      if (i >= maxLen) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <motion.div
      className="shq-speech"
      initial={{ scale: 0.5, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.5, opacity: 0, y: 10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {displayed || '...'}
    </motion.div>
  );
}

// ─── Particle Trail ─────────────────────────────────────────
function ParticleTrail({ isMoving, color }) {
  if (!isMoving) return null;
  return (
    <div className="shq-particles">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="shq-particle"
          style={{ background: color }}
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{
            opacity: 0,
            scale: 0.2,
            x: (Math.random() - 0.5) * 30,
            y: (Math.random() - 0.5) * 30,
          }}
          transition={{ duration: 0.8, delay: i * 0.08, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

// ─── Single Agent Character ─────────────────────────────────
function AgentCharacter({ agent, isActive, isDone, position, taskTitle, completedCount, totalSteps }) {
  const gradient = ROLE_GRADIENTS[agent.role] || ['#94a3b8', '#64748b'];
  const emoji = ROLE_EMOJI[agent.role] || '👤';
  const [isMoving, setIsMoving] = useState(false);

  // Detect movement from position changes
  useEffect(() => {
    setIsMoving(true);
    const t = setTimeout(() => setIsMoving(false), 1200);
    return () => clearTimeout(t);
  }, [position.x, position.y]);

  return (
    <motion.div
      className={`shq-character ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
      animate={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
      transition={{
        type: 'spring',
        stiffness: 80,
        damping: 18,
        mass: 1,
      }}
      style={{ position: 'absolute' }}
    >
      <AnimatePresence>
        {isActive && taskTitle && (
          <TypingSpeechBubble text={taskTitle} />
        )}
      </AnimatePresence>

      <ParticleTrail isMoving={isMoving && isActive} color={gradient[0]} />

      <motion.div
        className="shq-avatar"
        style={{
          background: isDone
            ? 'linear-gradient(135deg, #059669, #10b981)'
            : `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        }}
        animate={isActive ? {
          boxShadow: [
            `0 0 15px ${gradient[0]}60`,
            `0 0 30px ${gradient[0]}90`,
            `0 0 15px ${gradient[0]}60`,
          ],
        } : {}}
        transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
      >
        <span className="shq-emoji">{isDone ? '✅' : emoji}</span>

        {/* Pulsing ring for active */}
        {isActive && (
          <motion.div
            className="shq-ring"
            style={{ borderColor: gradient[0] }}
            animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}

        {/* Mini progress arc */}
        {totalSteps > 0 && (
          <svg className="shq-progress-ring" viewBox="0 0 48 48">
            <circle
              cx="24" cy="24" r="21"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2.5"
            />
            <motion.circle
              cx="24" cy="24" r="21"
              fill="none"
              stroke={isDone ? '#10b981' : gradient[0]}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 21}
              animate={{
                strokeDashoffset: 2 * Math.PI * 21 * (1 - completedCount / totalSteps)
              }}
              transition={{ duration: 0.6 }}
              style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
            />
          </svg>
        )}
      </motion.div>

      <motion.span
        className="shq-name"
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={isActive ? { duration: 2, repeat: Infinity } : {}}
      >
        {agent.name}
      </motion.span>
    </motion.div>
  );
}

// ─── SVG Connection Lines ───────────────────────────────────
function ConnectionLines({ agents, steps, results }) {
  const lines = useMemo(() => {
    if (!steps || steps.length === 0) return [];
    const activeLines = [];

    steps.forEach(step => {
      if (!step.dependsOnSteps || step.dependsOnSteps.length === 0) return;
      const toAgent = agents.find(a => a.id === step.assignedAgentId);
      if (!toAgent) return;

      step.dependsOnSteps.forEach(depNum => {
        const depStep = steps.find(s => s.stepNumber === depNum);
        if (!depStep) return;
        const fromAgent = agents.find(a => a.id === depStep.assignedAgentId);
        if (!fromAgent || fromAgent.id === toAgent.id) return;

        const isCompleted = results && results[depNum] !== undefined;
        activeLines.push({
          key: `${depNum}-${step.stepNumber}`,
          from: getAgentPos(fromAgent, agents, false),
          to: getAgentPos(toAgent, agents, false),
          completed: isCompleted,
        });
      });
    });
    return activeLines;
  }, [agents, steps, results]);

  if (lines.length === 0) return null;

  return (
    <svg className="shq-connections" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.3" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {lines.map(line => (
        <motion.line
          key={line.key}
          x1={`${line.from.x}%`} y1={`${line.from.y}%`}
          x2={`${line.to.x}%`} y2={`${line.to.y}%`}
          stroke={line.completed ? '#10b98180' : 'url(#lineGrad)'}
          strokeWidth={line.completed ? 1 : 1.5}
          strokeDasharray={line.completed ? 'none' : '6 4'}
          filter={line.completed ? 'none' : 'url(#glow)'}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  );
}

// ─── Position Helper ────────────────────────────────────────
function getAgentPos(agent, allAgents, isActive) {
  if (isActive) return CENTER;

  const home = ROLE_HOME[agent.role] || { x: 45, y: 45 };
  const sameRole = allAgents.filter(a => a.active && a.role === agent.role);
  const idx = sameRole.findIndex(a => a.id === agent.id);
  const spread = idx > 0 ? idx * 5 : 0;

  return { x: home.x + spread, y: home.y + (idx % 2 === 0 ? 0 : 5) };
}

// ─── Status Ticker ──────────────────────────────────────────
function StatusTicker({ steps }) {
  const completedSteps = steps?.filter(s => s.status === 'completed') || [];
  const last = completedSteps[completedSteps.length - 1];

  return (
    <div className="shq-ticker">
      <AnimatePresence mode="wait">
        {last && (
          <motion.div
            key={last.stepNumber}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="shq-ticker-item"
          >
            <span className="shq-ticker-check">✅</span>
            <span>Step {last.stepNumber} completed: {last.title}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main SwarmHQ Component ─────────────────────────────────
export default function SwarmHQ({ agents, steps, ceoStep, isRunning }) {
  const activeAgents = useMemo(() => agents.filter(a => a.active), [agents]);

  // Determine which agent is currently running
  const runningStep = steps?.find(s => s.status === 'running');
  const activeAgentId = runningStep
    ? runningStep.assignedAgentId
    : (ceoStep?.status === 'running' ? 'ceo' : null);

  // Build results map from completed steps
  const completedResults = useMemo(() => {
    const r = {};
    steps?.forEach(s => {
      if (s.status === 'completed') r[s.stepNumber] = true;
    });
    return r;
  }, [steps]);

  const completedCount = steps?.filter(s => s.status === 'completed').length || 0;
  const totalSteps = steps?.length || 0;

  // Track which agents have completed all their assigned steps
  const agentDoneMap = useMemo(() => {
    const m = {};
    if (!steps) return m;
    activeAgents.forEach(a => {
      const mySteps = steps.filter(s => s.assignedAgentId === a.id);
      if (mySteps.length > 0) {
        m[a.id] = mySteps.every(s => s.status === 'completed');
      }
    });
    return m;
  }, [steps, activeAgents]);

  if (!isRunning && (!steps || steps.length === 0)) return null;

  return (
    <motion.div
      className="shq-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Status ticker */}
      <StatusTicker steps={steps} />

      {/* Floor plan */}
      <div className="shq-floor">
        <div className="shq-grid-overlay" />

        {/* Departments */}
        {DEPARTMENTS.map(dept => (
          <motion.div
            key={dept.id}
            className="shq-dept"
            style={{
              gridColumn: dept.gridCol,
              gridRow: dept.gridRow,
              '--dept-color': dept.color,
            }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <div className="shq-dept-header">
              <span className="shq-dept-icon">{dept.icon}</span>
              <span className="shq-dept-label">{dept.label}</span>
            </div>
          </motion.div>
        ))}

        {/* Center collaboration zone */}
        <div className="shq-center-zone" style={{ gridColumn: 2, gridRow: '1 / span 2' }}>
          <motion.div
            className="shq-center-ring"
            animate={{
              scale: activeAgentId ? [1, 1.05, 1] : 1,
              opacity: activeAgentId ? [0.3, 0.6, 0.3] : 0.15,
            }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <span className="shq-center-label">
            {activeAgentId ? '⚡ ACTIVE' : '🔄 STANDBY'}
          </span>
        </div>

        {/* SVG connection lines */}
        <ConnectionLines agents={activeAgents} steps={steps} results={completedResults} />

        {/* Animated Characters */}
        <div className="shq-characters-layer">
          <AnimatePresence>
            {activeAgents.map(agent => {
              const isActive = activeAgentId === agent.id;
              const isDone = agentDoneMap[agent.id] || false;
              const pos = getAgentPos(agent, activeAgents, isActive);
              const taskTitle = isActive
                ? (runningStep ? runningStep.title : 'Planning roadmap...')
                : null;

              return (
                <AgentCharacter
                  key={agent.id}
                  agent={agent}
                  isActive={isActive}
                  isDone={isDone}
                  position={pos}
                  taskTitle={taskTitle}
                  completedCount={completedCount}
                  totalSteps={totalSteps}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
