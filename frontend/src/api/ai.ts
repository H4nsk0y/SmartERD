// frontend/src/api/ai.ts
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const API = 'http://localhost:8787';

export async function aiChat(messages: ChatMessage[]): Promise<string> {
  const r = await fetch(`${API}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'AI chat failed');
  return j.reply as string;
}

// НОВОЕ: генерация ER
export async function aiGenerateER(description: string) {
  const r = await fetch(`${API}/api/ai/er/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'AI ER generate failed');
  // вернём { entities, relationships, spec }
  return { entities: j.entities, relationships: j.relationships, spec: j.spec };
}
