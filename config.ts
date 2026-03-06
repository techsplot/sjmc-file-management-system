const runtimeApiBase = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL;

export const API_BASE_URL = runtimeApiBase || 'http://localhost:3001';
