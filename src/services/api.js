/**
 * API service to communicate with the local OpenClaw gateway via our Vite middleware.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchModels() {
  const response = await fetch(`${API_BASE}/api/models`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.details || 'Failed to fetch OpenClaw models.');
  }
  const data = await response.json();
  return data.models || [];
}

export async function runInference(model, prompt) {
  const response = await fetch(`${API_BASE}/api/infer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt }),
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.details || 'Inference failed. Check OpenClaw connection.');
  }
  
  const data = await response.json();
  if (data.ok && data.outputs && data.outputs[0]) {
    return data.outputs[0].text;
  }
  
  throw new Error('Inference returned empty or invalid response.');
}
