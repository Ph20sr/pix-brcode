import { crc16 } from './crc16.js';

const GUI = 'br.gov.bcb.pix';

/** Remove acentos e qualquer caractere fora do ASCII imprimível (o BR Code é ASCII). */
export function sanitize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

/** Campo TLV: ID (2) + tamanho (2) + valor. */
function tlv(id, value) {
  const v = String(value);
  if (v.length > 99) throw new RangeError(`Campo ${id} excede 99 caracteres`);
  return id + String(v.length).padStart(2, '0') + v;
}

const KEY_PATTERNS = {
  cpf: /^\d{11}$/,
  cnpj: /^[0-9A-Z]{12}\d{2}$/,
  phone: /^\+55\d{10,11}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  evp: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};

/**
 * Identifica o tipo da chave Pix e devolve a forma normalizada que vai no
 * BR Code (telefone com +55, e-mail minúsculo, CPF/CNPJ só com dígitos).
 */
export function normalizeKey(key) {
  const raw = String(key ?? '').trim();
  if (KEY_PATTERNS.evp.test(raw)) return { type: 'evp', key: raw.toLowerCase() };
  if (KEY_PATTERNS.email.test(raw)) return { type: 'email', key: raw.toLowerCase() };

  const digits = raw.replace(/[^\dA-Za-z+]/g, '').toUpperCase();
  if (KEY_PATTERNS.phone.test(digits)) return { type: 'phone', key: digits };
  if (/^\+/.test(raw)) throw new TypeError(`Telefone inválido: ${raw}`);
  if (KEY_PATTERNS.cpf.test(digits)) return { type: 'cpf', key: digits };
  if (KEY_PATTERNS.cnpj.test(digits)) return { type: 'cnpj', key: digits };
  throw new TypeError(`Chave Pix inválida: ${raw}`);
}

/**
 * Gera o Pix "copia e cola" (BR Code estático).
 *
 * @param {object} p
 * @param {string} p.key        chave Pix (CPF, CNPJ, e-mail, +55 telefone ou aleatória)
 * @param {string} p.name       nome do recebedor (até 25 caracteres)
 * @param {string} p.city       cidade do recebedor (até 15 caracteres)
 * @param {number} [p.amount]   valor em reais; omitido = pagador digita o valor
 * @param {string} [p.txid]     identificador (até 25, [A-Za-z0-9]); padrão "***"
 * @param {string} [p.description] mensagem exibida ao pagador
 * @param {boolean} [p.singleUse] marca o código como de uso único
 */
export function createPix({ key, name, city, amount, txid = '***', description, singleUse = false }) {
  const { key: pixKey } = normalizeKey(key);
  const merchant = sanitize(name).slice(0, 25);
  const merchantCity = sanitize(city).slice(0, 15);
  if (!merchant) throw new TypeError('Informe o nome do recebedor');
  if (!merchantCity) throw new TypeError('Informe a cidade do recebedor');
  if (txid !== '***' && !/^[A-Za-z0-9]{1,25}$/.test(txid)) {
    throw new TypeError('txid deve ter de 1 a 25 caracteres alfanuméricos');
  }

  let account = tlv('00', GUI) + tlv('01', pixKey);
  const info = sanitize(description);
  if (info) {
    // O campo 26 inteiro tem limite de 99; a descrição usa o espaço que sobrar
    const room = 99 - account.length - 4;
    if (room > 0) account += tlv('02', info.slice(0, room));
  }

  let payload = tlv('00', '01');
  if (singleUse) payload += tlv('01', '12');
  payload += tlv('26', account);
  payload += tlv('52', '0000');
  payload += tlv('53', '986');
  if (amount != null) {
    if (!(Number.isFinite(amount) && amount > 0)) throw new RangeError('amount deve ser um número positivo');
    payload += tlv('54', amount.toFixed(2));
  }
  payload += tlv('58', 'BR');
  payload += tlv('59', merchant);
  payload += tlv('60', merchantCity);
  payload += tlv('62', tlv('05', txid));
  payload += '6304';
  return payload + crc16(payload);
}

function parseTLV(text) {
  const fields = {};
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const len = Number(text.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > text.length) {
      throw new SyntaxError(`TLV malformado na posição ${i}`);
    }
    fields[id] = text.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return fields;
}

/**
 * Lê e valida um Pix copia e cola. Lança SyntaxError se o formato ou o CRC
 * estiverem errados.
 */
export function parsePix(code) {
  const text = String(code ?? '').trim();
  if (!/6304[0-9A-Fa-f]{4}$/.test(text)) throw new SyntaxError('Código sem CRC (campo 63)');
  const expected = crc16(text.slice(0, -4));
  if (expected !== text.slice(-4).toUpperCase()) throw new SyntaxError('CRC inválido: o código foi alterado ou digitado errado');

  const f = parseTLV(text);
  if (f['00'] !== '01') throw new SyntaxError('Payload Format Indicator inválido');
  const account = parseTLV(f['26'] ?? '');
  if ((account['00'] ?? '').toLowerCase() !== GUI) throw new SyntaxError('Não é um BR Code Pix');
  const extra = parseTLV(f['62'] ?? '');

  return {
    key: account['01'] ?? null,
    url: account['25'] ?? null, // Pix dinâmico (cobrança com location)
    description: account['02'] ?? null,
    amount: f['54'] ? Number(f['54']) : null,
    name: f['59'] ?? '',
    city: f['60'] ?? '',
    txid: extra['05'] ?? null,
    singleUse: f['01'] === '12',
    dynamic: Boolean(account['25']),
  };
}

export function isValidPix(code) {
  try {
    parsePix(code);
    return true;
  } catch {
    return false;
  }
}
