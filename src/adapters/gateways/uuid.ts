const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Colunas de identificador sao UUID no banco. Uma string fora desse formato faz
 * o driver lancar erro de sintaxe, o que viraria 500 na API. Como identificador
 * malformado simplesmente nao existe, os gateways o tratam como "nao encontrado"
 * e devolvem null, preservando o 404.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
