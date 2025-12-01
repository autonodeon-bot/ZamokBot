
import { BOT_TOKENS } from './botConfig.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetId, message, botId } = req.body;
  
  // Нормализуем имя бота (убираем @ если есть)
  const cleanBotId = botId ? botId.replace('@', '').trim() : 'default';

  // Логика выбора токена:
  // 1. Ищем токен по имени
  // 2. Если не нашли, берем default
  // 3. Если в конфиге нет, пробуем ENV
  
  let token = BOT_TOKENS[cleanBotId] || BOT_TOKENS["default"];

  // Fallback для надежности
  if (!token) {
    token = process.env.TELEGRAM_BOT_TOKEN; 
  }

  if (!token) {
    console.error(`Token not found for botId: ${cleanBotId}`);
    return res.status(500).json({ error: 'Server configuration error: Token missing' });
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
