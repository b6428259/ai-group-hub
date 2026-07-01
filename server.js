import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS so the static frontend hosted on Vercel can communicate with this API
app.use(cors());
app.use(express.json());

// Resolve SUT API Key on startup
let apiKey = process.env.SUT_OPENWEBUI_API_KEY;
if (!apiKey) {
  try {
    const modelsPath = 'C:\\Users\\iooon\\.openclaw\\agents\\main\\agent\\models.json';
    if (fs.existsSync(modelsPath)) {
      const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
      apiKey = data.providers?.['sut-openwebui']?.apiKey;
      console.log('Successfully resolved SUT API Key from models.json');
    }
  } catch (err) {
    console.error('Failed to read SUT API key from models.json:', err.message);
  }
}

if (!apiKey) {
  apiKey = 'sk-60139017ac794f349449f05cba00afff';
  console.log('Using default fallback SUT API Key');
}

// 1. Endpoint to list models via local OpenClaw CLI
app.get('/api/models', (req, res) => {
  let output = '';
  let errorOutput = '';
  const child = spawn('cmd.exe', ['/c', 'openclaw', 'models', 'list', '--json'], { shell: false });
  
  child.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  child.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });
  
  child.on('close', (code) => {
    if (code === 0) {
      const start = output.indexOf('[');
      const end = output.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        res.json(JSON.parse(output.substring(start, end + 1)));
      } else {
        res.send(output);
      }
    } else {
      res.status(500).json({ error: 'Failed to list models', details: errorOutput || output });
    }
  });
});

// 2. Endpoint to process inferences directly using HTTP to SUT GenAI
app.post('/api/infer', async (req, res) => {
  try {
    const { model, prompt } = req.body;
    if (!model || !prompt) {
      return res.status(400).json({ error: 'Missing model or prompt' });
    }

    const cleanModel = model.startsWith('sut-openwebui/') 
      ? model.replace('sut-openwebui/', '') 
      : model;

    console.log(`Routing inference to SUT: ${cleanModel}`);

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

// Start Express server on 0.0.0.0
app.listen(port, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🚀 Standalone Backend API listening at: http://0.0.0.0:${port}`);
  console.log(`CORS enabled for remote cross-origin access.`);
  console.log(`==================================================`);
});
