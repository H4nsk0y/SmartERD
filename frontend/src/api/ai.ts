// frontend/src/api/ai.ts
import { API_BASE } from "./client";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function aiChat(messages: ChatMessage[]): Promise<string> {
  const r = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ messages }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || "AI chat failed");
  return j.reply as string;
}

export async function aiGenerateER(description: string) {
  const r = await fetch(`${API_BASE}/api/ai/er/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ description }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || "AI ER generate failed");
  return { entities: j.entities, relationships: j.relationships, spec: j.spec };
}
