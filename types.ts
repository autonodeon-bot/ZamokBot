
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
  location: string; // "Москва" или "Московская область"
  serviceType: string; // "Квартира", "Автомобиль" и т.д.
  name: string;
  phone: string;
  requestTime: string;
  source?: string;
}

export interface StoredRequest {
  id: string;
  timestamp: number;
  location: string;
  serviceType: string;
  name: string;
  phone: string;
  source: string;
}

export enum AppStep {
  WELCOME,
  SELECT_LOCATION, // Выбор: Москва или МО
  SELECT_SERVICE,  // Выбор: Квартира, Сейф и т.д.
  INPUT_PHONE,     // Ввод телефона
  INPUT_NAME,      // Ввод имени
  PROCESSING,
  COMPLETED
}
