import { startTracing } from './otel';

/**
 * Efeito de importacao, de proposito.
 *
 * A auto-instrumentacao precisa aplicar monkey-patch em http, express e pg
 * antes de esses modulos serem carregados. O TypeScript compila para CommonJS,
 * onde os import viram require na ordem em que aparecem: importar este modulo na
 * primeira linha de main.ts garante a inicializacao antes dos demais. Chamar
 * startTracing() depois da lista de imports rodaria tarde demais, e o sintoma
 * seria trace vazio, sem erro nenhum.
 */
startTracing();
