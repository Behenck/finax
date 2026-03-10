# AGENTS.md (Backend - `apps/api`)

## Objetivo
Definir a estrutura, stack e convencoes do backend para orientar mudancas futuras de forma consistente com a API atual.

## Escopo de aplicacao
Aplica-se a tudo dentro de `apps/api`.

## Stack atual do backend
- Fastify + TypeScript
- `fastify-type-provider-zod` (schemas/typing de rotas com Zod)
- `@fastify/jwt` (autenticacao JWT)
- `@fastify/cors`
- `@fastify/swagger` + `@scalar/fastify-api-reference` (docs em `/docs` e `/docs/json`)
- Prisma + PostgreSQL (`@prisma/adapter-pg`, `@prisma/client`)
- Vitest + Supertest (testes de rotas)
- Biome (formatacao/lint)

## Entrypoints e arquivos-chave
- `src/server.ts`: sobe o servidor HTTP (`0.0.0.0:3333`)
- `src/app.ts`: monta a app Fastify, plugins, docs, healthcheck e registro central de rotas
- `src/lib/prisma.ts`: client Prisma (usando adapter PostgreSQL)
- `src/middleware/auth.ts`: plugin de autenticacao e helpers de request
- `prisma/schema.prisma`: fonte da modelagem de dados
- `generated/prisma/*`: client Prisma gerado (nao editar manualmente)
- `test/utils/test-app.ts`: helper para testes com `buildApp()`

## Estrutura de pastas (mapa pratico)
- `src/routes/*`: rotas organizadas por dominio (auth, orgs, members, transactions, etc.)
- `src/routes/_errors`: erros customizados de rota
- `src/middleware`: plugins/middlewares Fastify reutilizaveis
- `src/lib`: integracoes compartilhadas (ex.: Prisma)
- `src/utils`: utilitarios
- `src/@types`: extensoes de tipos
- `test/routes/*`: testes de rotas por dominio
- `test/utils`: utilitarios de teste
- `test/factories`: factories para testes
- `prisma/schema.prisma`: schema Prisma (fonte de verdade)
- `generated/prisma`: codigo gerado do Prisma

## Convencoes de rotas

### Organizacao por dominio
- Cada dominio deve ficar em `src/routes/<dominio>`.
- O dominio normalmente possui um `index.ts` que registra as sub-rotas daquele modulo.
- O registro central dos modulos acontece em `src/app.ts`.
- Ao adicionar um novo modulo de rotas, registrar em `src/app.ts`.

### Definicao de rotas
- Seguir o padrao Fastify + `withTypeProvider<ZodTypeProvider>()`.
- Declarar `schema` da rota com Zod (ex.: `body`, `response`, `summary`, `tags`) para manter contrato/documentacao.
- Preferir respostas tipadas e consistentes com os schemas declarados.
- Reutilizar erros customizados em `src/routes/_errors` quando aplicavel.

### Tipagem (obrigatorio)
- Sempre priorizar tipagem forte e explicita em rotas, utilitarios e acesso a dados.
- Evitar `any` e tipos implicitos quando houver tipo derivado de schema Zod/Prisma.
- Em respostas HTTP, garantir coerencia entre implementacao e tipo declarado no `schema.response`.

### Autenticacao e middleware
- Antes de criar novo middleware, verificar se o plugin existente em `src/middleware/auth.ts` cobre o caso.
- Reaproveitar helpers de request ja adicionados pelo middleware (ex.: identificacao de usuario/membership).
- Manter o padrao de `preHandler`/plugins Fastify ja adotado no projeto.

## Prisma e dados
- A fonte de verdade do modelo de dados e `prisma/schema.prisma`.
- O client Prisma gerado fica em `generated/prisma` e nao deve ser editado manualmente.
- Nao executar comandos destrutivos em banco (ex.: `prisma migrate reset`, `DROP`, `TRUNCATE`) sem permissao explicita do usuario na conversa atual.
- Mudancas de schema/modelo devem considerar:
- migracao (`pnpm db:migrate`) quando houver alteracao estrutural no banco
- geracao do client (`pnpm db:generate`)
- impacto nas rotas/queries e no contrato exposto

## Documentacao OpenAPI e impacto no frontend
- A API expoe docs em:
- `/docs` (UI Scalar)
- `/docs/json` (OpenAPI consumido pelo frontend/Kubb)
- Mudancas em request/response/schemas/rotas impactam o OpenAPI.
- Quando o contrato mudar, comunicar/ajustar o frontend:
- consultar `apps/web/AGENTS.md`
- regenerar integracao Kubb no frontend
- adaptar hooks/paginas afetados

## Testes (Vitest + Supertest)
- Adicionar testes em `test/routes/<dominio>/...` seguindo o padrao existente.
- Usar `createTestApp()` de `test/utils/test-app.ts` para subir a app em memoria.
- Usar `supertest` para chamadas HTTP de integracao.
- Para mudancas em rotas existentes, preferir adicionar/ajustar teste no mesmo dominio.

## Padroes de mudanca (checklists)

### 1) Novo endpoint
- Identificar dominio correto em `src/routes/<dominio>`.
- Criar arquivo de rota seguindo o padrao local.
- Declarar schema Zod (body/params/query/response) e metadados (`summary`, `tags`) quando aplicavel.
- Registrar rota no `index.ts` do dominio.
- Garantir que o dominio esteja registrado em `src/app.ts`.
- Adicionar teste em `test/routes/<dominio>`.

### 2) Alteracao em endpoint existente
- Atualizar logica mantendo compatibilidade quando necessario.
- Revisar schema Zod da rota (entrada/saida).
- Revisar impacto em erros/status code.
- Ajustar/adicionar teste de rota.
- Se contrato mudar, sinalizar impacto no frontend/Kubb.

### 3) Mudanca de schema/modelo Prisma
- Alterar `prisma/schema.prisma`.
- Rodar fluxo de migracao/geracao apropriado (`db:migrate`, `db:generate`) conforme tipo de mudanca.
- Ajustar queries Prisma nas rotas/servicos afetados.
- Revisar impacto no contrato da API e nos testes.
- Nao editar `generated/prisma/*` manualmente.

### 4) Mudanca com impacto no frontend (contrato OpenAPI/Kubb)
- Confirmar que os schemas Zod da rota refletem o contrato esperado.
- Validar impacto em `/docs/json`.
- Coordenar regeneracao do client Kubb no frontend.
- Atualizar payloads/respostas consumidos por hooks/paginas no frontend.

## Estilo e qualidade
- Seguir formatacao do Biome (tabs e aspas duplas).
- Usar alias `@/` para imports internos quando aplicavel.
- Manter consistencia com o dominio/arquivo existente em vez de introduzir um novo padrao local.
- Em duvidas de implementacao, escolher a opcao com melhor seguranca de tipos.

## O que nao fazer
- Nao editar `generated/prisma/*` manualmente.
- Nao registrar rotas novas diretamente em `src/app.ts` sem encapsular em modulo de dominio (salvo excecoes intencionais e pequenas).
- Nao alterar contrato de rota sem atualizar schema Zod correspondente.
- Nao fazer mudanca de banco sem avaliar migracao/geracao/testes.

## Mudancas que cruzam fronteiras (backend <-> frontend)
- Sempre que alterar contrato da API:
- verificar impacto em `apps/web/src/http/generated`
- considerar regeneracao via Kubb
- alinhar ajustes em hooks/paginas do frontend
- consultar `apps/web/AGENTS.md` para manter o padrao do frontend

## Manutencao desta documentacao
Atualize este arquivo quando houver:
- nova convencao de rotas/middleware
- mudanca na stack de docs/OpenAPI
- mudanca no fluxo Prisma (schema, geracao, migracao)
- mudanca importante na estrategia de testes
