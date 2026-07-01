import { runInference } from './api';

// Helper to map AI role text to existing agent IDs
function mapAgentId(text, activeAgents) {
  if (!text) return 'coder';
  const clean = text.toLowerCase();
  
  // Try direct match by ID or Name or Role
  const match = activeAgents.find(a => 
    a.id.toLowerCase() === clean || 
    a.name.toLowerCase().includes(clean) || 
    a.role.toLowerCase().includes(clean) || 
    clean.includes(a.role.toLowerCase())
  );
  
  if (match) return match.id;
  
  // Common keyword mapping fallbacks
  if (clean.includes('code') || clean.includes('dev') || clean.includes('program') || clean.includes('software') || clean.includes('eng')) {
    return activeAgents.find(a => a.role.toLowerCase() === 'coder')?.id || 'coder';
  }
  if (clean.includes('write') || clean.includes('content') || clean.includes('copy') || clean.includes('author') || clean.includes('research') || clean.includes('culinary')) {
    return activeAgents.find(a => a.role.toLowerCase() === 'writer')?.id || 'writer';
  }
  if (clean.includes('qa') || clean.includes('review') || clean.includes('edit') || clean.includes('test') || clean.includes('editor')) {
    return activeAgents.find(a => a.role.toLowerCase() === 'reviewer')?.id || 'reviewer';
  }
  if (clean.includes('pm') || clean.includes('manager') || clean.includes('lead') || clean.includes('director') || clean.includes('product')) {
    return activeAgents.find(a => a.role.toLowerCase() === 'pm')?.id || 'pm';
  }
  if (clean.includes('cto') || clean.includes('architect') || clean.includes('tech chief')) {
    return activeAgents.find(a => a.role.toLowerCase() === 'cto')?.id || 'cto';
  }
  if (clean.includes('sec') || clean.includes('board') || clean.includes('assistant')) {
    return activeAgents.find(a => a.role.toLowerCase() === 'secretary')?.id || 'secretary';
  }
  if (clean.includes('ceo') || clean.includes('executive')) {
    return 'ceo';
  }
  
  return activeAgents[1]?.id || 'coder'; // default fallback
}

/**
 * Orchestrator service using 3-tier parsing (JSON -> XML -> Markdown) for ultimate compatibility.
 * Executes independent tasks in PARALLEL using a Directed Acyclic Graph (DAG) scheduler.
 */
export async function runOrchestration({
  mainTask,
  ceoModel,
  agents,
  onStepStart,
  onStepOutput,
  onStepComplete,
  onStepError,
  onCEOPlanCreated,
  onFinalResponse,
  onAgentHired,
  existingSteps, // Optional: list of steps from a previous run to resume
}) {
  const activeAgents = agents.filter(a => a.active);
  const agentsListText = activeAgents
    .map(a => `- ID: "${a.id}", Name: "${a.name}", Role: "${a.role}" (Expertise: ${a.systemPrompt.slice(0, 120)}...)`)
    .join('\n');

  let processedSteps = [];
  const hiredAgentsMap = {};
  const results = {};

  if (existingSteps && existingSteps.length > 0) {
    // --- RESUME MODE ---
    processedSteps = [...existingSteps];
    
    // Pre-populate results with already completed steps
    processedSteps.forEach(s => {
      if (s.status === 'completed' && s.output) {
        results[s.stepNumber] = s.output;
      }
    });

    onStepStart(-1, 'ceo', 'CEO', `Resuming roadmap with ${processedSteps.length} steps. Skipping completed ones...`);
    // Briefly sleep to show transition status
    await new Promise(r => setTimeout(r, 1200));

  } else {
    // --- NEW RUN MODE ---
    onStepStart(-1, 'ceo', 'CEO', 'Analyzing task, hiring agents, and planning execution...');
    
    const ceoPlanPrompt = `Create a step-by-step task execution plan for a team of specialized AI agents representing a corporate enterprise to solve: "${mainTask}"

Corporate Agent Directory:
${agentsListText}

Workflow Hierarchy Guidelines:
1. PHASE 1: MEETING & ALIGNMENT (Assigned to: Secretary) - The Secretary gathers initial directives and outlines the project brief.
2. PHASE 2: GOALS & ROADMAP (Assigned to: CEO) - The CEO sets the high-level objectives and targets.
3. PHASE 3: TECHNICAL ARCHITECTURE (Assigned to: CTO) - The CTO defines technical system designs and database/file structures.
4. PHASE 4: EXECUTION & TASK PM (Assigned to: PM) - The Product Manager breaks down technical designs into specific tasks for subordinates.
5. PHASE 5: WORK EXECUTION (Assigned to: Developer / Copywriter / etc.) - The specialists write the code, write the documents, and implement.
6. PHASE 6: QUALITY INSPECTION (Assigned to: QA Reviewer) - Inspects deliverables for code errors, recipes, and text quality.
7. PHASE 7: MINUTES & WRAP-UP (Assigned to: Secretary) - Compiles all outputs into a corporate report.
8. PHASE 8: FINAL CEO SIGN-OFF (Assigned to: CEO) - CEO signs off and delivers the final package.

If no existing agent fits a specific execution role (e.g. you need a specialized database DBA or chef), you can hire a new specialized agent by setting "newAgentSpec".
To save tokens, specify which step numbers this step depends on in the depends_on tag (comma-separated).

You MUST wrap the planning details of each step in the following XML tags:
<step>
  <number>1</number>
  <title>Short Step Title</title>
  <description>Detailed instructions for what the agent should do.</description>
  <assigned_agent>existing_agent_id OR a temporary new agent ID</assigned_agent>
  <depends_on></depends_on> <!-- step numbers this step depends on, comma separated. e.g. 1 or 1,2. Leave empty if none -->
  
  <!-- Include new_agent ONLY if assigned_agent is a new temporary ID -->
  <new_agent>
    <name>Full name of the new agent</name>
    <role>Single-word role badge (e.g. Developer, Chef, Security)</role>
    <system_prompt>Instructions defining how this hired agent should behave.</system_prompt>
  </new_agent>
</step>

You can write explanations or introductions if you want, but you MUST include the <step> tags for each step.`;

    let planText = await runInference(ceoModel, ceoPlanPrompt);
    let steps = [];
    
    // --- TIER 1: JSON Parsing ---
    try {
      const cleaned = planText.replace(/```json|```/g, '').trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(cleaned.substring(start, end + 1));
        if (Array.isArray(parsed) && parsed.length > 0) {
          steps = parsed.map((s, index) => ({
            stepNumber: s.stepNumber || s.step || (index + 1),
            title: s.title || s.task || `Step ${index + 1}`,
            description: s.description || s.details?.description || 'No description provided.',
            assignedAgentId: mapAgentId(s.assignedAgentId || s.assignedAgent, activeAgents),
            dependsOnSteps: s.dependsOnSteps || s.depends || [],
            newAgentSpec: s.newAgentSpec || null
          }));
        }
      }
    } catch (e) {
      // ignore JSON failure
    }

    // --- TIER 2: XML Parsing ---
    if (steps.length === 0) {
      const stepMatches = planText.match(/<step>[\s\S]*?<\/step>/g);
      if (stepMatches && stepMatches.length > 0) {
        steps = stepMatches.map((stepXml, index) => {
          const getTag = (tag) => {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
            const match = stepXml.match(regex);
            return match ? match[1].trim() : '';
          };

          const stepNumber = parseInt(getTag('number')) || (index + 1);
          const title = getTag('title') || `Step ${stepNumber}`;
          const description = getTag('description') || 'No description provided.';
          const assignedAgentId = mapAgentId(getTag('assigned_agent'), activeAgents);
          const dependsStr = getTag('depends_on');
          const dependsOnSteps = dependsStr ? dependsStr.split(',').map(s => parseInt(s.trim())).filter(Number) : [];
          
          let newAgentSpec = null;
          const newAgentXml = getTag('new_agent');
          if (newAgentXml) {
            const name = (newAgentXml.match(/<name>([\s\S]*?)<\/name>/) || ['',''])[1].trim();
            const role = (newAgentXml.match(/<role>([\s\S]*?)<\/role>/) || ['',''])[1].trim();
            const prompt = (newAgentXml.match(/<system_prompt>([\s\S]*?)<\/system_prompt>/) || ['',''])[1].trim();
            if (name && role && prompt) {
              newAgentSpec = { name, role, systemPrompt: prompt };
            }
          }

          return { stepNumber, title, description, assignedAgentId, dependsOnSteps, newAgentSpec };
        });
      }
    }

    // --- TIER 3: Fallback Markdown parsing ---
    if (steps.length === 0) {
      const stepBlocks = planText.split(/(?=###?\s*(?:Step|Agent|Phase|\*\*Step|\*\*Agent)\s*\d+|####?\s*(?:Step|Agent)\s*\d+)/gi);
      
      let currentStepNum = 1;
      for (const block of stepBlocks) {
        const hasStepNumber = block.match(/(?:Step|Agent|Phase)\s*(\d+)/i);
        if (!hasStepNumber) continue;

        const stepNumber = parseInt(hasStepNumber[1]) || currentStepNum;
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;
        
        const titleLine = lines[0].replace(/^#+\s*/, '').replace(/^\*+\s*/, '').trim();
        const title = titleLine || `Step ${stepNumber}`;

        let assignedAgentId = 'coder';
        let newAgentSpec = null;
        let foundAgentText = '';
        
        for (const line of lines) {
          const agentMatch = line.match(/(?:agent|assigned|role|responsible)\s*:\s*\*?`?([^`*\n]+)/i);
          if (agentMatch) {
            foundAgentText = agentMatch[1].trim();
            break;
          }
        }
        
        if (foundAgentText) {
          assignedAgentId = mapAgentId(foundAgentText, activeAgents);
          const isExisting = activeAgents.some(a => 
            a.id.toLowerCase() === foundAgentText.toLowerCase() || 
            a.role.toLowerCase() === foundAgentText.toLowerCase()
          );
          
          if (!isExisting && foundAgentText.toLowerCase() !== 'pm' && foundAgentText.toLowerCase() !== 'ceo' && foundAgentText.toLowerCase() !== 'cto' && foundAgentText.toLowerCase() !== 'secretary') {
            newAgentSpec = {
              name: `${foundAgentText} Agent`,
              role: foundAgentText.replace(/[^a-zA-Z]/g, ''),
              systemPrompt: `You are a specialized ${foundAgentText}. Provide expert output for: ${title}.`
            };
            assignedAgentId = `new_agent_${stepNumber}`;
          }
        }

        const descriptionLines = lines.slice(1).filter(line => {
          const isMeta = line.match(/(?:agent|assigned|role|dependencies|dependency|output|deliverable)\s*:/i);
          const isHeading = line.startsWith('#');
          return !isMeta && !isHeading;
        });
        const description = descriptionLines.join('\n') || `Perform task: ${title}`;

        let dependsOnSteps = [];
        for (const line of lines) {
          const depMatch = line.match(/(?:dependencies|dependency|depends on|depends)\s*:\s*([^\n]+)/i);
          if (depMatch) {
            const numbers = depMatch[1].match(/\d+/g);
            if (numbers) {
              dependsOnSteps = numbers.map(Number);
            }
            break;
          }
        }

        steps.push({
          stepNumber,
          title,
          description,
          assignedAgentId,
          dependsOnSteps,
          newAgentSpec
        });
        currentStepNum = stepNumber + 1;
      }
    }

    if (steps.length === 0) {
      steps = [
        {
          stepNumber: 1,
          title: "Work Execution",
          description: `Execute the task: ${mainTask}`,
          assignedAgentId: activeAgents[1]?.id || 'coder',
          dependsOnSteps: []
        },
        {
          stepNumber: 2,
          title: "Review & Quality Control",
          description: `Review the execution of: ${mainTask}`,
          assignedAgentId: activeAgents[3]?.id || 'reviewer',
          dependsOnSteps: [1]
        }
      ];
    }

    // Pre-process steps to handle dynamic agent specs
    for (const step of steps) {
      const processedStep = { ...step };
      
      if (step.newAgentSpec) {
        const tempId = step.assignedAgentId;
        const newId = `hired_${step.newAgentSpec.role.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        const newAgent = {
          id: newId,
          name: step.newAgentSpec.name,
          role: step.newAgentSpec.role,
          systemPrompt: step.newAgentSpec.systemPrompt,
          model: ceoModel,
          temperature: 0.5,
          active: true,
          isHired: true
        };
        
        hiredAgentsMap[tempId] = newAgent;
        processedStep.assignedAgentId = newId;
        
        if (onAgentHired) {
          onAgentHired(newAgent);
        }
      }
      processedSteps.push(processedStep);
    }
    
    onCEOPlanCreated(processedSteps);
    onStepComplete(-1, `CEO created plan with ${processedSteps.length} steps.`);
  }

  // --- 3. Parallel Execution Stage (DAG Engine) ---
  const activePromises = {};
  
  // Helper to determine if a step is ready to execute (all dependencies completed)
  const canStartStep = (step) => {
    if (step.status === 'completed' || step.status === 'error') return false; // Already finished or failed
    if (step.status === 'running') return false; // Currently executing
    if (activePromises[step.stepNumber]) return false; // Promise still active
    
    const dependencies = step.dependsOnSteps || [];
    return dependencies.every(depNum => results[depNum] !== undefined);
  };

  while (true) {
    const runnableSteps = processedSteps.filter(canStartStep);
    const runningCount = Object.keys(activePromises).length;

    if (runnableSteps.length === 0) {
      if (runningCount === 0) {
        // No runnable steps left and no tasks running: execution finished successfully
        break;
      }
      // Wait for the next running task to complete before scanning for newly unlocked dependencies
      try {
        await Promise.race(Object.values(activePromises));
      } catch (e) {
        // One step errored — continue loop so other parallel steps can finish
        console.warn('⚠️ A step errored during parallel execution:', e.message);
      }
      continue;
    }

    // Start all ready tasks in parallel
    runnableSteps.forEach(step => {
      // Mark as running LOCALLY so canStartStep won't pick it up again
      step.status = 'running';

      const stepPromise = (async () => {
        const stepIdx = processedSteps.findIndex(s => s.stepNumber === step.stepNumber);
        const agent = activeAgents.find(a => a.id === step.assignedAgentId) || 
                      Object.values(hiredAgentsMap).find(a => a.id === step.assignedAgentId) ||
                      activeAgents[0];
                      
        onStepStart(stepIdx, agent.id, agent.name, `Running Step ${step.stepNumber}: ${step.title}...`);
        
        const dependencyStepNumbers = step.dependsOnSteps || [];
        const MAX_DEP_OUTPUT = 2000;
        const previousOutputsCombined = dependencyStepNumbers
          .map(stepNum => {
            const prevStep = processedSteps.find(s => s.stepNumber === stepNum);
            const outputVal = results[stepNum];
            if (prevStep && outputVal) {
              const agName = activeAgents.find(ag => ag.id === prevStep.assignedAgentId)?.name || 
                             Object.values(hiredAgentsMap).find(ag => ag.id === prevStep.assignedAgentId)?.name || 
                             'Agent';
              const truncated = outputVal.length > MAX_DEP_OUTPUT
                ? outputVal.slice(0, MAX_DEP_OUTPUT) + '\n[...TRUNCATED]'
                : outputVal;
              return `### Output from Step ${stepNum} [${agName}]:\n${truncated}\n`;
            }
            return '';
          })
          .filter(Boolean)
          .join('\n');

        // Build execution status context so agent knows project state
        const statusLines = processedSteps.map(s => {
          const sAgent = activeAgents.find(a => a.id === s.assignedAgentId) ||
                         Object.values(hiredAgentsMap).find(a => a.id === s.assignedAgentId);
          const name = sAgent?.name || 'Agent';
          if (s.status === 'completed') return `  ✅ Step ${s.stepNumber}: ${s.title} [${name}] — COMPLETED`;
          if (s.status === 'running') return `  🔄 Step ${s.stepNumber}: ${s.title} [${name}] — RUNNING`;
          if (s.status === 'error') return `  ❌ Step ${s.stepNumber}: ${s.title} [${name}] — FAILED`;
          return `  📋 Step ${s.stepNumber}: ${s.title} [${name}] — PENDING`;
        }).join('\n');

        let agentPrompt = `[SYSTEM]
${agent.systemPrompt}

TOKEN EFFICIENCY RULES:
- Be concise. Do NOT repeat or paraphrase the instructions back.
- Do NOT explain what you are about to do. Just do it.
- Output ONLY your deliverable (code, text, analysis). No filler.
- This step is STEP ${step.stepNumber} of ${processedSteps.length}.

PORT CONFIGURATION CONSTRAINT:
If you write, modify, configure, or run any web application or web server (e.g. using node, python, http-server, etc.), you MUST NOT use port 3000, 3001, 3002, 5173, 5174, or 8080. Those ports are occupied by Vite, the system API, and the dashboard. Instead, you MUST use a port in the range 8000-8020 (e.g., 8000, 8001, etc.).

You have access to the following local tools to search the internet and interact with your computer:

1. Web Search:
<tool_call>
  <name>web_search</name>
  <arguments>
    <query>search query text</query>
  </arguments>
</tool_call>

2. Fetch URL:
<tool_call>
  <name>fetch_url</name>
  <arguments>
    <url>https://example.com</url>
  </arguments>
</tool_call>

3. Read File:
<tool_call>
  <name>read_file</name>
  <arguments>
    <path>filename.ext</path>
  </arguments>
</tool_call>

4. Write File:
<tool_call>
  <name>write_file</name>
  <arguments>
    <path>filename.ext</path>
    <content>file contents go here</content>
  </arguments>
</tool_call>

5. Run Command:
<tool_call>
  <name>run_command</name>
  <arguments>
    <command>command to execute in local shell</command>
  </arguments>
</tool_call>

To use a tool, output a single <tool_call> XML block in your response. Do not output anything else if you are using a tool. Once the tool executes, you will receive the result and can output more tool calls or your final response.

[EXECUTION STATUS]
${statusLines}

[USER]
Main Goal: ${mainTask}

${previousOutputsCombined ? `Relevant previous steps outputs for context:\n${previousOutputsCombined}` : 'No previous step context needed for this task.'}

Your specific task for this step (Step ${step.stepNumber}):
${step.description}

Provide your response. Use a tool if you need to access files, run commands, or search the web.`;

        try {
          const API_BASE = import.meta.env.VITE_API_URL || '';
          let stepOutput = '';
          const maxTurns = 5;
          
          for (let turn = 0; turn < maxTurns; turn++) {
            stepOutput = await runInference(agent.model || ceoModel, agentPrompt);
            
            // Check if agent wants to execute a tool
            const toolMatch = stepOutput.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
            if (!toolMatch) {
              break; // No tool call, final output ready!
            }
            
            const toolXml = toolMatch[1];
            const toolName = (toolXml.match(/<name>([\s\S]*?)<\/name>/) || ['',''])[1].trim();
            const argsXml = (toolXml.match(/<arguments>([\s\S]*?)<\/arguments>/) || ['',''])[1].trim();
            
            let toolArgs = {};
            if (toolName === 'web_search') {
              toolArgs = { query: (argsXml.match(/<query>([\s\S]*?)<\/query>/) || ['',''])[1].trim() };
            } else if (toolName === 'fetch_url') {
              toolArgs = { url: (argsXml.match(/<url>([\s\S]*?)<\/url>/) || ['',''])[1].trim() };
            } else if (toolName === 'read_file') {
              toolArgs = { path: (argsXml.match(/<path>([\s\S]*?)<\/path>/) || ['',''])[1].trim() };
            } else if (toolName === 'write_file') {
              toolArgs = { 
                path: (argsXml.match(/<path>([\s\S]*?)<\/path>/) || ['',''])[1].trim(),
                content: (argsXml.match(/<content>([\s\S]*?)<\/content>/) || ['',''])[1].trim()
              };
            } else if (toolName === 'run_command') {
              toolArgs = { command: (argsXml.match(/<command>([\s\S]*?)<\/command>/) || ['',''])[1].trim() };
            }
            
            // Show tool execution status in UI
            onStepStart(stepIdx, agent.id, agent.name, `[Tool: ${toolName}] Running tool for step ${step.stepNumber}...`);
            
            let toolResult = '';
            try {
              const res = await fetch(`${API_BASE}/api/tools/${toolName.replace('_', '-')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toolArgs)
              });
              const data = await res.json();
              if (data.success) {
                toolResult = data.output || data.content || 'Success.';
              } else {
                toolResult = `Error: ${data.error || 'Execution failed.'}`;
              }
            } catch (err) {
              toolResult = `Fetch failed: ${err.message}`;
            }
            
            // Append turn output and tool results back into history
            agentPrompt += `\n\n${stepOutput}\n\n[SYSTEM]
Tool '${toolName}' executed. Result:
${toolResult}

Analyze the result and continue your work. Output another <tool_call> if you need it, or write your final response.`;
          }
          
          // ✅ Mark step as COMPLETED locally so DAG never re-fires it
          step.status = 'completed';
          results[step.stepNumber] = stepOutput;
          onStepComplete(stepIdx, stepOutput);
        } catch (err) {
          // ❌ Mark step as ERROR locally so DAG skips it
          step.status = 'error';
          onStepError(stepIdx, err.message);
          // Do NOT re-throw — let other parallel steps continue
        } finally {
          delete activePromises[step.stepNumber];
        }
      })();

      activePromises[step.stepNumber] = stepPromise;
    });

    // Tick the loop when the first promise resolves (or rejects)
    try {
      await Promise.race(Object.values(activePromises));
    } catch (e) {
      // Handled inside each step — continue scanning
    }
  }

  // --- 4. CEO Synthesis Stage ---
  const executionLogs = processedSteps.map(step => {
    const agent = activeAgents.find(a => a.id === step.assignedAgentId) || 
                  Object.values(hiredAgentsMap).find(a => a.id === step.assignedAgentId) ||
                  activeAgents[0];
    return {
      stepNumber: step.stepNumber,
      agentName: agent.name,
      output: results[step.stepNumber] || step.output || ''
    };
  });

  // Early-exit: skip expensive CEO synthesis if only 1-2 meaningful outputs
  const meaningfulLogs = executionLogs.filter(l => l.output && l.output.trim().length > 20);
  if (meaningfulLogs.length <= 1) {
    const singleOutput = meaningfulLogs[0]?.output || executionLogs[executionLogs.length - 1]?.output || 'Task completed.';
    onStepComplete(processedSteps.length, singleOutput);
    onFinalResponse(singleOutput);
    return;
  }

  onStepStart(processedSteps.length, 'ceo', 'CEO', 'Consolidating outputs and generating final response...');

  // Truncate each log output for synthesis to save tokens
  const SYNTH_MAX = 1500;
  const synthesisOutputsText = executionLogs
    .map(log => {
      const truncOut = log.output.length > SYNTH_MAX
        ? log.output.slice(0, SYNTH_MAX) + '\n[...TRUNCATED]'
        : log.output;
      return `### Step ${log.stepNumber} by [${log.agentName}]:\n${truncOut}\n`;
    })
    .join('\n');
      
  const synthesisPrompt = `You are the CEO of the AI Group. The team has completed all sub-tasks for the user's request.

User request: "${mainTask}"

Here are the individual outputs of each agent:
${synthesisOutputsText}

Consolidate these outputs into a concise, professional final response. Be brief. Output in Markdown.`;

  const finalResponse = await runInference(ceoModel, synthesisPrompt);
  onStepComplete(processedSteps.length, finalResponse);
  onFinalResponse(finalResponse);
}
