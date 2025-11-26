
import { DEFAULT_TARGET_ID } from '../constants';
import { StoredRequest } from '../types';

const KEY_ID = 'locksmith_target_id';
const KEY_REQ = 'locksmith_requests';

export const getTargetId = (): string => {
  if (typeof window === 'undefined') return DEFAULT_TARGET_ID;
  return localStorage.getItem(KEY_ID) || DEFAULT_TARGET_ID;
};

export const setTargetId = (id: string) => {
  localStorage.setItem(KEY_ID, id);
};

export const getRequests = (): StoredRequest[] => {
  try {
    const data = localStorage.getItem(KEY_REQ);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveRequest = (req: StoredRequest) => {
  const list = getRequests();
  list.push(req);
  localStorage.setItem(KEY_REQ, JSON.stringify(list));
};
