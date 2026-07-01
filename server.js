import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for remote cross-origin access from Vercel domain
app.use(cors());
app.use(express.json());

// Resolve paths dynamically based on host OS and Docker environment
let modelsPath = process.env.OPENCLAW_MODELS_PATH;
if (!modelsPath) {
  const winPath = 'C:\\Users\\iooon\\.openclaw\\agents\\main\\agent\\models.json';
  const linuxPath = '/home/ion20155/.openclaw/agents/main/agent/models.json';
  const dockerPath = '/app/config/models.json';
  
  if (fs.existsSync(winPath)) modelsPath = winPath;
  else if (fs.existsSync(linuxPath)) modelsPath = linuxPath;
  else if (fs.existsSync(dockerPath)) modelsPath = dockerPath;
  else modelsPath = linuxPath; // Fallback
}

console.log(`Resolved models config path: ${modelsPath}`);

// Resolve SUT API Key
let apiKey = process.env.SUT_OPENWEBUI_API_KEY;
if (!apiKey) {
  try {
    if (fs.existsSync(modelsPath)) {
      const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
      apiKey = data.providers?.['sut-openwebui']?.apiKey;
      console.log('SUT API Key resolved successfully from models.json');
    }
  } catch (err) {
    console.error('Failed to read SUT API key:', err.message);
  }
}

if (!apiKey) {
  apiKey = 'sk-60139017ac794f349449f05cba00afff';
  console.log('Using default fallback SUT API Key');
}

// 1. Endpoint to list models (parses models.json directly, 100% Docker-compatible)
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

app.listen(port, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🚀 Standalone Backend API listening at: http://0.0.0.0:${port}`);
  console.log(`Config: ${modelsPath}`);
  console.log(`==================================================`);
});
