
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
  isMoscow: boolean;
  district: string;
  name: string;
  phone: string;
  requestTime: string;
  source?: string;
}

export interface StoredRequest {
  id: string;
  timestamp: number;
  district: string;
  name: string;
  phone: string;
  source: string;
}

export enum AppStep {
  WELCOME,
  CONFIRM_CITY,
  SELECT_DISTRICT,
  INPUT_CONTACT,
  PROCESSING,
  COMPLETED,
  OUT_OF_AREA
}
