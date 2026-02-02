// backend/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

import { SYSTEM_PROMPT, specToAppFormat, parseModelJson } from "./er-generate.js";

const app = express();
const prisma = new PrismaClient();

app.use(
  cors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "lm-studio",
  baseURL: process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || "http://127.0.0.1:1234/v1",
});

const MODEL = process.env.AI_MODEL || process.env.OPENAI_MODEL || "meta-llama-3.1-8b-instruct";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const token = h.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(200),
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: { name: data.name.trim(), email, passwordHash },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const token = signToken({ userId: user.id, email: user.email });
    return res.json({ ok: true, user, token });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "Invalid input", details: err.errors });
    }
    console.error("register error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ ok: false, error: "Wrong email or password" });

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Wrong email or password" });

    const token = signToken({ userId: user.id, email: user.email });
    return res.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      token,
    });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "Invalid input", details: err.errors });
    }
    console.error("login error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.get("/api/me", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });
    return res.json({ ok: true, user });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

const projectCreateSchema = z.object({
  name: z.string().min(1).max(120),
  data: z.any(),
});

const projectUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  data: z.any().optional(),
});

app.get("/api/projects", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
    return res.json({ ok: true, projects });
  } catch (err) {
    console.error("projects list error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.get("/api/projects/:id", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const id = String(req.params.id);

    const project = await prisma.project.findFirst({
      where: { id, userId },
      select: { id: true, name: true, data: true, createdAt: true, updatedAt: true },
    });

    if (!project) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, project });
  } catch (err) {
    console.error("project get error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/projects", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const data = projectCreateSchema.parse(req.body);

    const project = await prisma.project.create({
      data: { userId, name: data.name.trim(), data: data.data },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    return res.json({ ok: true, project });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "Invalid input", details: err.errors });
    }
    console.error("project create error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.put("/api/projects/:id", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const id = String(req.params.id);
    const patch = projectUpdateSchema.parse(req.body);

    const exists = await prisma.project.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return res.status(404).json({ ok: false, error: "Not found" });

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(patch.name ? { name: patch.name.trim() } : {}),
        ...(patch.data !== undefined ? { data: patch.data } : {}),
      },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    return res.json({ ok: true, project });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "Invalid input", details: err.errors });
    }
    console.error("project update error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.delete("/api/projects/:id", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const id = String(req.params.id);

    const exists = await prisma.project.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return res.status(404).json({ ok: false, error: "Not found" });

    await prisma.project.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("project delete error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "messages must be a non-empty array" });
    }

    const safeMessages = messages.map((m) => ({
      role: m.role === "system" || m.role === "assistant" || m.role === "user" ? m.role : "user",
      content: String(m.content ?? "").slice(0, 8000),
    }));

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: safeMessages,
      temperature: 0.2,
      max_tokens: 1024,
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    return res.json({ ok: true, reply: text });
  } catch (err) {
    console.error("AI error:", err?.response?.data || err);
    return res.status(500).json({ ok: false, error: "AI request failed" });
  }
});

app.post("/api/ai/er/generate", async (req, res) => {
  try {
    const { description } = req.body || {};
    if (!description || typeof description !== "string") {
      return res.status(400).json({ ok: false, error: "description (string) is required" });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: description.slice(0, 4000) },
    ];

    const resp = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
    });

    const rawText = resp?.choices?.[0]?.message?.content || "";
    const spec = parseModelJson(rawText);
    const { entities, relationships } = specToAppFormat(spec);

    return res.json({ ok: true, spec, entities, relationships });
  } catch (err) {
    console.error("ER generate error:", err?.response?.data || err);
    const msg = err?.message || "failed";
    return res.status(500).json({ ok: false, error: msg });
  }
});

export { app, prisma };

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT || 8787);
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });

  process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
