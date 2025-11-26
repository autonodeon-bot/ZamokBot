
import { UserRequest } from '../types';

// Полностью убрана зависимость от GoogleGenAI
export const generateConfirmationMessage = async (data: UserRequest): Promise<string> => {
  // Используем данные, чтобы избежать ошибки компиляции и персонализировать ответ
  return `Спасибо, ${data.name || 'Клиент'}! Ваша заявка принята. Мастер свяжется с вами по номеру ${data.phone} в ближайшее время.`;
};
