import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import fs from 'fs'

// Resolve SUT API Key on startup
let apiKey = process.env.SUT_OPENWEBUI_API_KEY;
if (!apiKey) {
  try {
    const modelsPath = 'C:\\Users\\iooon\\.openclaw\\agents\\main\\agent\\models.json';
    if (fs.existsSync(modelsPath)) {
      const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
      apiKey = data.providers?.['sut-openwebui']?.apiKey;
    }
  } catch (err) {
    console.error('Failed to read SUT API key from models.json:', err);
  }
}

// Fallback key if neither resolved
if (!apiKey) {
  apiKey = 'sk-60139017ac794f349449f05cba00afff';
}

function openClawMiddleware() {
  return {
    name: 'openclaw-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/models' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          
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
                res.end(output.substring(start, end + 1));
              } else {
                res.end(output);
              }
            } else {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to list models', details: errorOutput || output }));
            }
          });
          return;
        }

        if (req.url === '/api/infer' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          
          req.on('end', async () => {
            try {
              const { model, prompt } = JSON.parse(body);
              if (!model || !prompt) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing model or prompt' }));
                return;
              }

              // Extract actual model ID (remove provider prefix)
              const cleanModel = model.startsWith('sut-openwebui/') 
                ? model.replace('sut-openwebui/', '') 
                : model;

              // Direct HTTP request to SUT OpenAI-compatible endpoint
              // Bypasses local CLI process spawning and command-line character length limit completely
              try {
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
                  res.statusCode = response.status;
                  res.end(JSON.stringify({ error: 'SUT API Error', details: errBody }));
                  return;
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content || '';
                
                // Return in format expected by api.js
                res.end(JSON.stringify({
                  ok: true,
                  capability: 'model.run',
                  outputs: [{ text }]
                }));
              } catch (fetchErr) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'HTTP Fetch failed', details: fetchErr.message }));
              }
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
          });
          return;
        }

        next();
      });
    }
  }
}

export default defineConfig({
  plugins: [react(), openClawMiddleware()],
})
