/**
 * CRC16-CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), exigido pelo
 * Manual de Padrões para Iniciação do Pix no campo 63.
 * Retorna 4 caracteres hexadecimais em maiúsculas.
 */
export function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
