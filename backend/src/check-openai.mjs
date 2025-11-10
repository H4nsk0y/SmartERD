// backend/src/check-openai.mjs
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('❌ Переменная OPENAI_API_KEY не найдена. Проверь файл .env в /backend');
    process.exit(1);
  }

  console.log('➡ Использую ключ (первые 8 символов):', key.slice(0, 8) + '…');

  const openai = new OpenAI({ apiKey: key });

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
    });
    const text = res.choices?.[0]?.message?.content ?? '(пусто)';
    console.log('✅ Удалось обратиться к OpenAI. Ответ модели:', text);
  } catch (e) {
    console.error('❌ Ошибка при обращении к OpenAI');
    if (e.response) {
      console.error('status:', e.response.status);
      console.error('data  :', e.response.data);
    } else {
      console.error('name  :', e.name);
      console.error('code  :', e.code);
      console.error('message:', e.message);
      if (e.cause) console.error('cause :', e.cause);
    }
    process.exit(1);
  }
}

main();
