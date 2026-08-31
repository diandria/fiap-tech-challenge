import http from 'k6/http';
import { check } from 'k6';

/**
 * Carga de validacao ponta a ponta.
 *
 * Existe para que nenhum painel do M9 esteja vazio na gravacao: dashboard sem
 * dado e indistinguivel de dashboard quebrado, e nao da para descobrir isso
 * com a camera ligada.
 *
 * Cada cenario alimenta um painel diferente:
 *
 *   ciclo_de_os          -> volume de OS e tempo por status
 *   autenticacao_cliente -> latencia da rota que atravessa a function
 *   rajada               -> HPA subindo replicas (o painel da demonstracao)
 *   erros_deliberados    -> paineis de erro, que ficariam zerados sem isto
 *
 * Uso:
 *   BASE_URL=$(cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url) \
 *   ADMIN_PASSWORD=$(aws ssm get-parameter --name /car-repair-shop/app/admin-password \
 *     --with-decryption --query 'Parameter.Value' --output text) \
 *   k6 run scripts/load-test.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@master.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || '';

// CPF valido usado para o cliente de demonstracao. O codigo de confirmacao do
// orcamento sao os quatro primeiros digitos -- regra de negocio, nao truque do
// teste: `verifyCustomerCode` compara com `customer.taxId.slice(0, 4)`.
const CPF = __ENV.CPF || '52998224725';
const CODIGO_ORCAMENTO = CPF.slice(0, 4);

const JSON_HEADERS = { 'content-type': 'application/json' };

export const options = {
  scenarios: {
    // Volume baixo e constante: o ciclo completo importa pela cobertura das
    // transicoes, nao pelo volume. Cada iteracao percorre os seis status.
    ciclo_de_os: {
      executor: 'constant-arrival-rate',
      rate: 6, timeUnit: '1m', duration: '5m',
      preAllocatedVUs: 4, maxVUs: 10,
      exec: 'cicloDeOS',
    },

    // Atravessa gateway -> function de autenticacao -> lookup na aplicacao.
    autenticacao_cliente: {
      executor: 'constant-arrival-rate',
      rate: 10, timeUnit: '1m', duration: '5m',
      preAllocatedVUs: 3, maxVUs: 8,
      exec: 'autenticacaoCliente',
      startTime: '15s',
    },

    // A rajada que faz o HPA escalar.
    //
    // Taxa de chegada, e nao numero de VUs: o gateway impoe 100 req/s com
    // burst de 200, por configuracao deliberada (e o "controle" que o
    // enunciado pede dele). Um teste guiado por VUs acelera ate o gateway
    // recusar, e a partir dai mede o throttle -- nao a aplicacao. Numa
    // execucao com 40 VUs sem pausa isso deu 131 req/s e **20.367 respostas
    // 4xx no gateway**, enquanto a aplicacao respondia 200 em tudo que
    // chegava nela. O grafico ficava alarmante sem nada estar errado.
    //
    // 60 req/s deixa folga para os outros cenarios e ainda satura os pods o
    // suficiente: medido em 31/08/2026, o HPA foi de 2 ate o teto de 10.
    rajada: {
      executor: 'ramping-arrival-rate',
      startRate: 0, timeUnit: '1s',
      preAllocatedVUs: 20, maxVUs: 60,
      stages: [
        { duration: '30s', target: 60 },
        { duration: '3m', target: 60 },
        { duration: '30s', target: 0 },
      ],
      exec: 'rajada',
      startTime: '30s',
    },

    // Sem isto os paineis de erro ficam zerados, e um painel zerado na
    // gravacao levanta a duvida de se ele funciona.
    erros_deliberados: {
      executor: 'constant-arrival-rate',
      rate: 12, timeUnit: '1m', duration: '5m',
      preAllocatedVUs: 2, maxVUs: 5,
      exec: 'errosDeliberados',
      startTime: '20s',
    },
  },

  // A rajada e feita para saturar: exigir latencia baixa aqui reprovaria a
  // execucao justamente quando ela cumpre seu proposito. O que nao pode e
  // erro tecnico -- e 4xx dos erros deliberados nao conta como falha do k6,
  // porque as chamadas usam `check` e nao `fail`.
  thresholds: {
    'http_req_failed{scenario:ciclo_de_os}': ['rate<0.10'],
    'http_req_failed{scenario:autenticacao_cliente}': ['rate<0.10'],

    // A rajada tambem precisa passar limpa. Se falhar aqui, a carga passou do
    // limite do gateway e a execucao inteira perde valor como validacao.
    'http_req_failed{scenario:rajada}': ['rate<0.05'],
  },
};

function autenticar(url, corpo) {
  const r = http.post(url, JSON.stringify(corpo), { headers: JSON_HEADERS });
  if (r.status !== 200) return null;
  try { return r.json('token'); } catch (e) { return null; }
}

export function setup() {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD nao definido. Leia do SSM: ' +
      'aws ssm get-parameter --name /car-repair-shop/app/admin-password --with-decryption');
  }

  const token = autenticar(`${BASE_URL}/auth/login`,
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!token) throw new Error('login do admin falhou; o ambiente esta de pe?');

  const auth = { headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` } };

  // Cliente e veiculo sao criados uma vez, no setup, e reaproveitados. Criar a
  // cada iteracao encheria o banco de ruido e mediria o custo do INSERT em vez
  // do fluxo que interessa.
  let clienteId = __ENV.CUSTOMER_ID;
  if (!clienteId) {
    const r = http.post(`${BASE_URL}/customers`, JSON.stringify({
      name: 'Cliente de Carga', taxId: CPF, taxType: 'CPF',
      email: 'carga@teste.com', phone: '11999999999',
    }), auth);
    // 409 significa que ja existe de uma execucao anterior: buscamos o id.
    if (r.status === 201) {
      clienteId = r.json('id');
    } else {
      const busca = http.get(`${BASE_URL}/customers?taxId=${CPF}`, auth);
      const lista = busca.json();
      clienteId = Array.isArray(lista) && lista.length ? lista[0].id
        : (lista && lista.data && lista.data.length ? lista.data[0].id : null);
    }
  }
  if (!clienteId) throw new Error('nao foi possivel obter o cliente de carga');

  let veiculoId = __ENV.VEHICLE_ID;
  if (!veiculoId) {
    const r = http.post(`${BASE_URL}/vehicles`, JSON.stringify({
      customerId: clienteId, plate: `CRG${Math.floor(Math.random() * 9000 + 1000)}`,
      brand: 'Fiat', model: 'Uno', year: 2020,
    }), auth);
    veiculoId = r.status === 201 ? r.json('id') : null;
  }
  if (!veiculoId) throw new Error('nao foi possivel obter o veiculo de carga');

  return { token, clienteId, veiculoId };
}

export function cicloDeOS(dados) {
  const auth = { headers: { ...JSON_HEADERS, authorization: `Bearer ${dados.token}` } };

  const criada = http.post(`${BASE_URL}/service-orders`, JSON.stringify({
    customerId: dados.clienteId, vehicleId: dados.veiculoId,
  }), auth);
  if (!check(criada, { 'OS criada': (r) => r.status === 201 })) return;

  const osId = criada.json('id');
  const mudar = (status) => http.patch(`${BASE_URL}/service-orders/${osId}`,
    JSON.stringify({ status }), auth);

  check(mudar('DIAGNOSIS'), { 'DIAGNOSIS': (r) => r.status === 200 });
  check(mudar('WAITING_APPROVAL'), { 'WAITING_APPROVAL': (r) => r.status === 200 });

  // A aprovacao e do cliente, nao do balcao: rota separada, token de cliente e
  // codigo de confirmacao.
  const tokenCliente = autenticar(`${BASE_URL}/auth/cpf`, { cpf: CPF });
  if (tokenCliente) {
    const r = http.patch(`${BASE_URL}/service-orders/${osId}/budget`,
      JSON.stringify({ status: 'APPROVED', code: CODIGO_ORCAMENTO }),
      { headers: { ...JSON_HEADERS, authorization: `Bearer ${tokenCliente}` } });
    check(r, { 'orcamento aprovado': (x) => x.status === 200 });
  }

  check(mudar('EXECUTION'), { 'EXECUTION': (r) => r.status === 200 });
  check(mudar('FINISHED'), { 'FINISHED': (r) => r.status === 200 });
  check(mudar('DELIVERED'), { 'DELIVERED': (r) => r.status === 200 });
}

export function autenticacaoCliente() {
  const token = autenticar(`${BASE_URL}/auth/cpf`, { cpf: CPF });
  check(token, { 'token de cliente emitido': (t) => !!t });
  if (!token) return;

  const r = http.get(`${BASE_URL}/service-orders`,
    { headers: { authorization: `Bearer ${token}` } });
  check(r, { 'cliente le as proprias OS': (x) => x.status === 200 });
}

// Uma requisicao por iteracao, de proposito: com a taxa de chegada fixada em
// 60/s, duas chamadas por iteracao dariam 120 req/s e estourariam o limite do
// gateway de novo.
export function rajada(dados) {
  const auth = { headers: { authorization: `Bearer ${dados.token}` } };
  const r = http.get(`${BASE_URL}/service-orders`, auth);
  check(r, {
    'listagem 200': (x) => x.status === 200,
    'sem throttling do gateway': (x) => x.status !== 429,
  });
}

export function errosDeliberados(dados) {
  const auth = { headers: { ...JSON_HEADERS, authorization: `Bearer ${dados.token}` } };

  // 404: recurso inexistente.
  check(http.get(`${BASE_URL}/service-orders/00000000-0000-0000-0000-000000000000`, auth),
    { 'devolve 404': (r) => r.status === 404 });

  // 400: transicao invalida. Erro de negocio, e nao tecnico -- popula o painel
  // de status sem contaminar a taxa de erro 5xx, que so conta falha tecnica.
  const criada = http.post(`${BASE_URL}/service-orders`, JSON.stringify({
    customerId: dados.clienteId, vehicleId: dados.veiculoId,
  }), auth);
  if (criada.status === 201) {
    const r = http.patch(`${BASE_URL}/service-orders/${criada.json('id')}`,
      JSON.stringify({ status: 'DELIVERED' }), auth);
    check(r, { 'transicao invalida devolve 400': (x) => x.status === 400 });
  }

  // 401: sem token.
  check(http.get(`${BASE_URL}/service-orders`), { 'sem token devolve 401': (r) => r.status === 401 });
}
