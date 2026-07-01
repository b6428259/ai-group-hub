import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { spawn } from 'child_process';

const app = express();
const port = process.env.PORT || 3002; // Use 3002 to avoid conflicts

// Enable CORS for remote cross-origin access
app.use(cors());
app.use(express.json());

// Resolve models config path
let modelsPath = process.env.OPENCLAW_MODELS_PATH;
if (!modelsPath) {
  const winPath = 'C:\\Users\\iooon\\.openclaw\\agents\\main\\agent\\models.json';
  const linuxPath = '/home/ion20155/models.json';
  const dockerPath = '/app/config/models.json';
  
  if (fs.existsSync(winPath)) modelsPath = winPath;
  else if (fs.existsSync(linuxPath)) modelsPath = linuxPath;
  else if (fs.existsSync(dockerPath)) modelsPath = dockerPath;
  else modelsPath = linuxPath;
}

console.log(`Resolved models config path: ${modelsPath}`);

// Resolve SUT API Key
let apiKey = process.env.SUT_OPENWEBUI_API_KEY;
if (!apiKey) {
  try {
    if (fs.existsSync(modelsPath)) {
      const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
      apiKey = data.providers?.['sut-openwebui']?.apiKey;
      console.log('SUT API Key resolved successfully');
    }
  } catch (err) {
    console.error('Failed to read SUT API key:', err.message);
  }
}

if (!apiKey) {
  apiKey = 'sk-60139017ac794f349449f05cba00afff';
  console.log('Using default fallback SUT API Key');
}

// 1. Endpoint to list models
app.get('/api/models', (req, res) => {
  try {
    if (!fs.existsSync(modelsPath)) {
      return res.status(500).json({ error: 'Config file not found', path: modelsPath });
    }
    const rawData = fs.readFileSync(modelsPath, 'utf8');
    const data = JSON.parse(rawData);
    const modelsList = [];

    if (data.providers) {
      Object.entries(data.providers).forEach(([providerId, provider]) => {
        if (provider.models) {
          provider.models.forEach(m => {
            modelsList.push({
              key: `${providerId}/${m.id}`,
              name: m.name || m.id
            });
          });
        }
      });
    }
    res.json({ models: modelsList });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse models configuration', details: err.message });
  }
});

// 2. Endpoint to process inferences
app.post('/api/infer', async (req, res) => {
  try {
    const { model, prompt } = req.body;
    if (!model || !prompt) {
      return res.status(400).json({ error: 'Missing model or prompt' });
    }

    const cleanModel = model.startsWith('sut-openwebui/') 
      ? model.replace('sut-openwebui/', '') 
      : model;

    console.log(`Routing completions for: ${cleanModel}`);

    const response = await fetch('https://genai.sut.ac.th/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: cleanModel,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: 'SUT API Error', details: errBody });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    res.json({
      ok: true,
      capability: 'model.run',
      outputs: [{ text }]
    });

  } catch (err) {
    res.status(500).json({ error: 'HTTP Fetch failed', details: err.message });
  }
});

// ==========================================
// 🛠️ AGENTIC LOCAL COMPUTER & INTERNET TOOLS
// ==========================================

// A. Web Search (Scrapes DuckDuckGo HTML search page cleanly)
app.post('/api/tools/web-search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ success: false, error: 'Missing query' });
  
  console.log(`🔍 [Tool: Web Search] Query: "${query}"`);
  
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    
    const results = [];
    // DuckDuckGo HTML layout regex search
    const titleRegex = /<a class="result__url" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    let count = 0;
    
    while ((match = titleRegex.exec(html)) !== null && count < 5) {
      const url = match[1].trim();
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();
      results.push({ title, url, snippet });
      count++;
    }
    
    if (results.length === 0) {
      return res.json({ success: true, output: "No search results returned or rate-limited. Try refinement." });
    }
    
    const output = results.map((r, i) => `Result #${i+1}: ${r.title}\nSource: ${r.url}\nSummary: ${r.snippet}\n`).join('\n');
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// B. Fetch URL (Scrapes a webpage, strips scripts/CSS and returns text)
app.post('/api/tools/fetch-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'Missing url' });
  
  console.log(`🌐 [Tool: Fetch URL] ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    
    let clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '');
    clean = clean.replace(/<[^>]*>/g, ' ')
                 .replace(/\s+/g, ' ')
                 .trim();
                 
    res.json({ success: true, content: clean.substring(0, 8000) }); // Cap at 8k to fit LLM contexts
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// C. Read File from local directory
app.post('/api/tools/read-file', (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ success: false, error: 'Missing path' });
  
  console.log(`📖 [Tool: Read File] ${path}`);
  
  try {
    if (!fs.existsSync(path)) {
      return res.status(404).json({ success: false, error: 'File does not exist.' });
    }
    const content = fs.readFileSync(path, 'utf8');
    res.json({ success: true, content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// D. Write File to local directory
app.post('/api/tools/write-file', (req, res) => {
  const { path, content } = req.body;
  if (!path || content === undefined) {
    return res.status(400).json({ success: false, error: 'Missing path or content' });
  }
  
  console.log(`💾 [Tool: Write File] ${path}`);
  
  try {
    fs.writeFileSync(path, content, 'utf8');
    res.json({ success: true, output: `File written successfully to ${path}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// E. Run Command locally in shell
app.post('/api/tools/run-command', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ success: false, error: 'Missing command' });
  
  console.log(`💻 [Tool: Run Command] "${command}"`);
  
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : '/bin/sh';
  const flag = isWindows ? '/c' : '-c';
  
  const child = spawn(shell, [flag, command], { shell: false });
  let output = '';
  let errorOutput = '';
  
  child.stdout.on('data', (data) => output += data.toString());
  child.stderr.on('data', (data) => errorOutput += data.toString());
  
  child.on('close', (code) => {
    res.json({
      success: true, // Return true so tool execution counts as successful block
      code,
      output: (output + '\n' + errorOutput).trim()
    });
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🚀 Standalone Backend API listening at: http://0.0.0.0:${port}`);
  console.log(`CORS and Agentic computer/network tools fully enabled.`);
  console.log(`==================================================`);
});
