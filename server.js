import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { spawn } from 'child_process';
import os from 'os';
import pathModule from 'path';

function resolvePath(inputPath) {
  if (!inputPath) return '';
  let resolved = inputPath;
  if (inputPath.startsWith('~')) {
    resolved = pathModule.join(os.homedir(), inputPath.slice(1));
  }
  return pathModule.resolve(resolved);
}

const app = express();
const port = process.env.PORT || 3002;

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

// Load all providers dynamically from models.json
let providersConfig = {};
try {
  if (fs.existsSync(modelsPath)) {
    const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    providersConfig = data.providers || {};
    console.log(`Successfully loaded ${Object.keys(providersConfig).length} providers from models.json`);
  }
} catch (err) {
  console.error('Failed to parse providers from models.json:', err.message);
}

// 1. Endpoint to list models (dynamically constructed from models.json)
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

// 2. Endpoint to process inferences (dynamically routes based on provider)
app.post('/api/infer', async (req, res) => {
  try {
    const { model, prompt } = req.body;
    if (!model || !prompt) {
      return res.status(400).json({ error: 'Missing model or prompt' });
    }

    // Determine provider ID and model ID
    const parts = model.split('/');
    const providerId = parts[0];
    const cleanModel = parts.slice(1).join('/');

    console.log(`Routing inference: Provider="${providerId}" Model="${cleanModel}"`);

    // Fetch config for this provider
    let provider = providersConfig[providerId];
    
    // Fallback if provider not explicitly configured but defaults exist
    if (!provider) {
      if (providerId === 'sut-openwebui') {
        provider = {
          baseUrl: 'https://genai.sut.ac.th/api',
          apiKey: process.env.SUT_OPENWEBUI_API_KEY || 'sk-60139017ac794f349449f05cba00afff'
        };
      } else {
        return res.status(400).json({ error: `Provider '${providerId}' is not configured in models.json` });
      }
    }

    const baseUrl = provider.baseUrl || 'https://genai.sut.ac.th/api';
    const apiKey = provider.apiKey;

    if (!apiKey) {
      return res.status(500).json({ error: `API Key missing for provider '${providerId}'` });
    }

    const targetUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    console.log(`Forwarding query to: ${targetUrl}`);

    const isMaxPlus = (providerId === 'maxplus-ai');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: cleanModel,
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: isMaxPlus
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: `${providerId} API Error`, details: errBody });
    }

    let text = '';

    if (isMaxPlus) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const content = json.choices?.[0]?.delta?.content || '';
              text += content;
            } catch (e) {
              // chunk parse error
            }
          }
        }
      }
    } else {
      const data = await response.json();
      text = data.choices?.[0]?.message?.content || '';
    }

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

app.post('/api/tools/web-search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ success: false, error: 'Missing query' });
  console.log(`🔍 [Tool: Web Search] Query: "${query}"`);
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await response.text();
    const results = [];
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

app.post('/api/tools/fetch-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'Missing url' });
  console.log(`🌐 [Tool: Fetch URL] ${url}`);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await response.text();
    let clean = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    clean = clean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    res.json({ success: true, content: clean.substring(0, 8000) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tools/read-file', (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ success: false, error: 'Missing path' });
  console.log(`📖 [Tool: Read File] ${path}`);
  try {
    let targetPath = resolvePath(path);
    const baseName = pathModule.basename(targetPath);
    if (baseName === 'index.html' || baseName === 'index.css') {
      if (fs.existsSync(`sandbox/${baseName}`)) {
        targetPath = pathModule.resolve(`sandbox/${baseName}`);
        console.log(`⚠️ Redirected read to: ${targetPath}`);
      }
    }
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: `File does not exist at: ${targetPath}` });
    }
    const content = fs.readFileSync(targetPath, 'utf8');
    res.json({ success: true, content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tools/write-file', (req, res) => {
  const { path, content } = req.body;
  if (!path || content === undefined) return res.status(400).json({ success: false, error: 'Missing path or content' });
  console.log(`💾 [Tool: Write File] ${path}`);
  try {
    let targetPath = resolvePath(path);
    const baseName = pathModule.basename(targetPath);
    if (baseName === 'index.html' || baseName === 'index.css' || baseName === 'server.js' || baseName === 'package.json' || baseName === 'vite.config.js') {
      if (!fs.existsSync('sandbox')) {
        fs.mkdirSync('sandbox');
      }
      targetPath = pathModule.resolve(`sandbox/${baseName}`);
      console.log(`⚠️ Redirected write to: ${targetPath}`);
    }
    
    // Ensure parent directories exist
    const parentDir = pathModule.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    fs.writeFileSync(targetPath, content, 'utf8');
    res.json({ success: true, output: `File written successfully to ${targetPath}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
      success: true,
      code,
      output: (output + '\n' + errorOutput).trim()
    });
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🚀 Standalone Backend API listening at: http://0.0.0.0:${port}`);
  console.log(`Dynamic Provider Routing (SUT / ManageAI) fully active.`);
  console.log(`==================================================`);
});
