
import { BOT_TOKENS } from './botConfig.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetId, message, botId } = req.body;
  
  // Логика выбора токена:
  // 1. Ищем токен по botId в конфиге (который берет его из env vars)
  // 2. Если не нашли, берем default
  // 3. Если default пустой в конфиге, пробуем напрямую process.env.TELEGRAM_BOT_TOKEN
  
  let token = null;

  // Проверяем, есть ли такой ключ и есть ли значение
  if (botId && BOT_TOKENS[botId]) {
    token = BOT_TOKENS[botId];
  } else {
    token = BOT_TOKENS["default"];
  }

  // Fallback для надежности (если вдруг botConfig сломался)
  if (!token) {
    token = process.env.TELEGRAM_BOT_TOKEN; 
  }

  if (!token) {
    console.error(`Token not found (Environment Variable missing) for botId: ${botId}`);
    return res.status(500).json({ error: 'Server configuration error: Token is missing in Environment Variables' });
  }

  if (!targetId || !message) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(tgUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: targetId,
        text: message,
        parse_mode: 'HTML'
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API Error:', data);
      return res.status(500).json({ error: 'Failed to send message', details: data });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
