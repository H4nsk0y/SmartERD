// backend/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, specToAppFormat, parseModelJson } from './er-generate.js';

const app = express();


app.use(cors({
  origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
}));
app.use(express.json({ limit: '1mb' }));

// LM Studio 
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'lm-studio',
  baseURL: process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234/v1',
});
const MODEL = process.env.OPENAI_MODEL || 'meta-llama-3.1-8b-instruct';

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: 'messages must be a non-empty array' });
    }
    const safeMessages = messages.map(m => ({
      role: (m.role === 'system' || m.role === 'assistant' || m.role === 'user') ? m.role : 'user',
      content: String(m.content ?? '').slice(0, 8000),
    }));
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: safeMessages,
      temperature: 0.2,
      max_tokens: 1024,
    });
    const text = response.choices?.[0]?.message?.content ?? '';
    return res.json({ ok: true, reply: text });
  } catch (err) {
    console.error('AI error:', err?.response?.data || err);
    return res.status(500).json({ ok: false, error: 'AI request failed' });
  }
});

// Сгенерировать ER по описанию (LLM -> JSON -> авто-правки -> формат фронта)
app.post('/api/ai/er/generate', async (req, res) => {
  try {
    const { description } = req.body || {};
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ ok: false, error: 'description (string) is required' });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: description.slice(0, 4000) },
    ];

    const resp = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
    });

    const rawText = resp?.choices?.[0]?.message?.content || '';
    const spec = parseModelJson(rawText);
    const { entities, relationships } = specToAppFormat(spec);

    return res.json({ ok: true, spec, entities, relationships });
  } catch (err) {
    console.error('ER generate error:', err?.response?.data || err);
    const msg = err?.message || 'failed';
    return res.status(500).json({ ok: false, error: msg });
  }
});

// Старт сервера
const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
