# pix-brcode

[![CI](https://github.com/Ph20sr/pix-brcode/actions/workflows/ci.yml/badge.svg)](https://github.com/Ph20sr/pix-brcode/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

Gera e lê o **Pix copia e cola** (BR Code) seguindo o *Manual de Padrões para Iniciação do Pix* do Banco Central. Não precisa de PSP, de API nem de dependências.

Os testes conferem a saída **byte a byte** com o exemplo oficial do manual (CRC `1D3D`).

- Chave **CPF, CNPJ (inclusive alfanumérico), e-mail, telefone ou aleatória**, identificada e normalizada automaticamente
- Valor fixo ou em aberto, `txid`, descrição e código de uso único
- Remove acentos e respeita os limites de tamanho (nome com 25 e cidade com 15 caracteres)
- **Leitura e validação**: `parsePix` confere o CRC16 e acusa código adulterado ou digitado errado
- Lê também Pix **dinâmico** (com URL de location)

## Uso

```js
import { createPix, parsePix } from 'pix-brcode';

const copiaECola = createPix({
  key: 'contato@padaria.com.br',
  name: 'Padaria São João',
  city: 'São Paulo',
  amount: 49.9,
  txid: 'PEDIDO1234',
  description: 'Pedido #1234',
});
// 00020126...6304XXXX

parsePix(copiaECola);
// { key: 'contato@padaria.com.br', amount: 49.9, name: 'Padaria Sao Joao', city: 'Sao Paulo', txid: 'PEDIDO1234', ... }
```

### QR Code

O payload é o conteúdo do QR Code. Use a biblioteca de QR que preferir:

```js
import QRCode from 'qrcode';
const svg = await QRCode.toString(copiaECola, { type: 'svg', errorCorrectionLevel: 'M' });
```

### Validar o que o cliente colou

```js
import { isValidPix } from 'pix-brcode';

isValidPix(textoColado); // false se o CRC não confere
```

## Estático × dinâmico

Este pacote gera **Pix estático**: a chave fica dentro do código, e ele funciona sem integração com banco. É ideal para loja física, cardápio, doações e link de pagamento simples. Para conciliação automática com webhook, use a cobrança do seu PSP (ex.: [`asaas-php`](https://github.com/Ph20sr/asaas-php)). O `parsePix` lê os dois tipos.

## API

| Função | Retorno |
| --- | --- |
| `createPix({ key, name, city, amount?, txid?, description?, singleUse? })` | `string` (copia e cola) |
| `parsePix(code)` | `{ key, url, description, amount, name, city, txid, singleUse, dynamic }` |
| `isValidPix(code)` | `boolean` |
| `normalizeKey(key)` | `{ type: 'cpf' \| 'cnpj' \| 'phone' \| 'email' \| 'evp', key }` |
| `crc16(text)` | `string` (4 hex) |

## Desenvolvimento

```bash
npm test
```

## Licença

MIT
