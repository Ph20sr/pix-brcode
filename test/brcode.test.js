import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, createPix, parsePix, isValidPix, normalizeKey, sanitize } from '../src/index.js';

// Exemplo do Manual de Padrões para Iniciação do Pix (Banco Central)
const MANUAL = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';

test('CRC16-CCITT-FALSE', () => {
  assert.equal(crc16('123456789'), '29B1', 'check value padrão do algoritmo');
  assert.equal(crc16(MANUAL.slice(0, -4)), '1D3D');
});

test('gera exatamente o exemplo do manual do Banco Central', () => {
  const code = createPix({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' });
  assert.equal(code, MANUAL);
});

test('valor, txid, descrição e uso único', () => {
  const code = createPix({
    key: 'contato@empresa.com.br',
    name: 'Padaria São João Ltda',
    city: 'São Paulo',
    amount: 49.9,
    txid: 'PEDIDO1234',
    description: 'Pedido #1234',
    singleUse: true,
  });
  const pix = parsePix(code);
  assert.equal(pix.amount, 49.9);
  assert.equal(pix.txid, 'PEDIDO1234');
  assert.equal(pix.name, 'Padaria Sao Joao Ltda', 'remove acentos');
  assert.equal(pix.city, 'Sao Paulo');
  assert.equal(pix.description, 'Pedido #1234');
  assert.equal(pix.singleUse, true);
  assert.ok(code.includes('540549.90'));
});

test('limita nome a 25 e cidade a 15 caracteres', () => {
  const pix = parsePix(createPix({ key: '52998224725', name: 'A'.repeat(40), city: 'B'.repeat(30) }));
  assert.equal(pix.name.length, 25);
  assert.equal(pix.city.length, 15);
});

test('normaliza e identifica chaves', () => {
  assert.deepEqual(normalizeKey('529.982.247-25'), { type: 'cpf', key: '52998224725' });
  assert.deepEqual(normalizeKey('12.ABC.345/01DE-35'), { type: 'cnpj', key: '12ABC34501DE35' });
  assert.deepEqual(normalizeKey('+55 (11) 98765-4321'), { type: 'phone', key: '+5511987654321' });
  assert.deepEqual(normalizeKey('Contato@Empresa.com'), { type: 'email', key: 'contato@empresa.com' });
  assert.equal(normalizeKey('123E4567-E12B-12D1-A456-426655440000').type, 'evp');
  assert.throws(() => normalizeKey('abc'), TypeError);
  assert.throws(() => normalizeKey('+1 555 0100'), TypeError);
});

test('rejeita parâmetros inválidos', () => {
  const base = { key: '52998224725', name: 'Loja', city: 'Recife' };
  assert.throws(() => createPix({ ...base, amount: 0 }), RangeError);
  assert.throws(() => createPix({ ...base, amount: -5 }), RangeError);
  assert.throws(() => createPix({ ...base, txid: 'com espaço' }), TypeError);
  assert.throws(() => createPix({ ...base, name: '' }), TypeError);
});

test('detecta código adulterado pelo CRC', () => {
  const tampered = MANUAL.replace('Fulano', 'Golpes');
  assert.equal(isValidPix(MANUAL), true);
  assert.equal(isValidPix(tampered), false);
  assert.throws(() => parsePix(tampered), /CRC inválido/);
  assert.equal(isValidPix('qualquer coisa'), false);
});

test('lê Pix dinâmico (location em vez de chave)', () => {
  const url = 'pix.exemplo.com.br/qr/v2/abc123';
  const account = `0014br.gov.bcb.pix25${String(url.length).padStart(2, '0')}${url}`;
  const payload = `00020101021226${String(account.length).padStart(2, '0')}${account}5204000053039865802BR5905Loja16006Recife62070503***6304`;
  const code = payload + crc16(payload);
  const pix = parsePix(code);
  assert.equal(pix.dynamic, true);
  assert.equal(pix.url, 'pix.exemplo.com.br/qr/v2/abc123');
  assert.equal(pix.key, null);
});

test('sanitize', () => {
  assert.equal(sanitize('  Ação & Cia™ '), 'Acao & Cia');
});
