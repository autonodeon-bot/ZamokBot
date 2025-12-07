
export enum Sender {
  BOT = 'BOT',
  USER = 'USER'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  type?: 'text' | 'options' | 'form';
  options?: string[];
}

export interface UserRequest {
  name: string;
  phone: string;
  metro: string; // Новое поле
  source?: string;
  telegramUser?: string; // Имя пользователя из ТГ
}

export interface StoredRequest {
  id: string;
  timestamp: number;
  name: string;
  phone: string;
  metro: string;
  source: string;
}

export enum AppStep {
  MENU,      // Главное меню (кнопки)
  FORM,      // Форма заявки
  SUCCESS    // Экран успеха
}
