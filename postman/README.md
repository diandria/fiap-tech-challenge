# Postman Collection — Car Repair Shop API

Coleção Postman com fluxo completo ponta a ponta da API: autenticação, cadastros, ciclo de vida da OS (diagnóstico → orçamento → aprovação → execução → entrega), rejeição de orçamento, estatísticas e cenários de erro (401/403/400/404).

## Arquivos

- `car-repair-shop.postman_collection.json` — coleção v2.1.0 com todas as chamadas organizadas em pastas numeradas.
- `car-repair-shop.postman_environment.json` — environment com `baseUrl`, credenciais e variáveis persistidas entre requests (tokens, IDs).

## Pré-requisitos

1. API rodando localmente em `http://localhost:3000` (ajuste `baseUrl` no environment se necessário).
2. MongoDB ativo conforme `.env`.
3. Admin seed executado. As credenciais padrão do environment são:
   - `adminEmail`: `admin@master.com`
   - `adminPassword`: `change-me-in-production`
   Ajuste no environment para bater com o `ADMIN_PASSWORD` configurado no `.env` do servidor.

## Import

No Postman: **Import → Upload Files** e selecione os dois arquivos. Em seguida, selecione o environment **Car Repair Shop — Local** no seletor do canto superior direito.

## Ordem de execução (fluxo)

Execute as pastas na ordem numerada. Cada request já persiste no environment o que as próximas precisam (token, IDs). Use o **Collection Runner** ou rode manualmente em sequência.

| # | Pasta | O que faz |
|---|-------|-----------|
| 00 | Setup | Login admin, cadastra attendant/mechanic (idempotente: aceita 201 ou 409), login dos dois perfis |
| 01 | Catálogo (admin) | Cria serviço (Troca de Óleo, R$ 120) e item (Óleo 5W30, R$ 40, estoque 10) |
| 02 | Cliente e Veículo (attendant) | Cria cliente CPF (taxId `52998224725`, primeiros 4 dígitos = código de aprovação `5299`) e veículo `ABC-1234` |
| 03 | Happy Path OS | Ciclo completo: cria OS → diagnóstico → adiciona serviço + item (qty 2) → finaliza diagnóstico (`budgetTotal = 200`) → consulta status público → aprova com código `5299` → execução → entrega |
| 04 | Rejeição | Segunda OS que é rejeitada após orçamento — verifica retorno do item ao estoque |
| 05 | Estatísticas e Listagens | `avg-execution`, filtros por `status` e `customerId`, detalhe por ID |
| 06 | Cenários de Erro | 401 (senha errada, sem token), 403 (role errada), 400 (CPF/placa inválida, código errado, transição inválida), 404 |

## Variáveis persistidas (setadas automaticamente)

`adminToken`, `attendantToken`, `mechanicToken`, `attendantId`, `mechanicId`, `customerId`, `customerTaxId`, `customerCode`, `vehicleId`, `serviceId`, `itemId`, `osId`, `osRejectId`.

## Regras de negócio validadas pelo fluxo

- Código de aprovação do cliente = primeiros 4 dígitos do CPF/CNPJ.
- Máquina de estados da OS: `RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED` (com ramo `REJECTED` a partir de `WAITING_APPROVAL`).
- Soma do orçamento = serviços + (item.price × quantity).
- Autorização por role: attendant (clientes/veículos/OS), mechanic (diagnóstico/execução), admin (catálogo).

## Rodando via CLI (Newman)

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```
