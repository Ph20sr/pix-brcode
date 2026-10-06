export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'evp';

export interface CreatePixOptions {
  key: string;
  name: string;
  city: string;
  amount?: number;
  txid?: string;
  description?: string;
  singleUse?: boolean;
}

export interface ParsedPix {
  key: string | null;
  url: string | null;
  description: string | null;
  amount: number | null;
  name: string;
  city: string;
  txid: string | null;
  singleUse: boolean;
  dynamic: boolean;
}

export function crc16(payload: string): string;
export function createPix(options: CreatePixOptions): string;
export function parsePix(code: string): ParsedPix;
export function isValidPix(code: string): boolean;
export function normalizeKey(key: string): { type: PixKeyType; key: string };
export function sanitize(text: string): string;
