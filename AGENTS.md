# AGENTS.md (Raiz)

## Objetivo
Este arquivo define a referencia estrutural do monorepo `finax` para orientar futuras mudancas feitas por agentes (Codex) e por pessoas.

Use este arquivo como guia global e, antes de implementar qualquer mudanca, consulte o `AGENTS.md` especifico da area afetada:

- Frontend: `apps/web/AGENTS.md`
- Backend: `apps/api/AGENTS.md`
- Mobile: `apps/mobile/AGENTS.md`

## Escopo de aplicacao
Aplica-se a todo o repositorio. Regras mais especificas em subpastas (`apps/web/AGENTS.md`, `apps/api/AGENTS.md` e `apps/mobile/AGENTS.md`) prevalecem dentro desses diretorios.

## Visao geral do projeto
- Monorepo com `pnpm` + `turbo`
- Apps principais:
- `apps/web` (frontend)
- `apps/api` (backend)
- `apps/mobile` (React Native + Expo Router)
- Node.js `>=22` (definido em `package.json`)

## Estrutura macro do repositorio
- `apps/web`: aplicacao frontend React/Vite
- `apps/api`: API Fastify + Prisma
- `apps/mobile`: app mobile React Native/Expo
- `package.json`: scripts da raiz (`dev`, `build`, `lint`)
- `turbo.json`: orquestracao de tarefas do monorepo
- `pnpm-workspace.yaml`: definicao do workspace

## Como navegar por tipo de mudanca
- Mudanca somente no frontend: ler `apps/web/AGENTS.md` antes de implementar.
- Mudanca somente no backend: ler `apps/api/AGENTS.md` antes de implementar.
- Mudanca somente no mobile: ler `apps/mobile/AGENTS.md` antes de implementar.
- Mudanca full-stack (contrato + UI): ler ambos (`apps/web/AGENTS.md` e `apps/api/AGENTS.md`) e planejar impacto cruzado.

## Regras globais para o Codex
- Preferir mudancas minimas e aderentes aos padroes ja existentes do projeto.
- Preservar a organizacao atual por dominio/pasta; nao reorganizar estrutura sem necessidade explicita.
- Respeitar aliases `@/*` tanto no frontend quanto no backend.
- Sempre priorizar tipagem forte e explicita; evitar `any` e tipos implicitos quando houver alternativa tipada.
- Nao editar manualmente codigo gerado.
- Nao executar comandos destrutivos de banco (ex.: `prisma migrate reset`, `db reset`, `DROP`, `TRUNCATE`) sem permissao explicita do usuario na conversa atual.
- Em arquivos grandes com multiplas responsabilidades, separar por funcionalidade quando houver ganho claro (componentes, hooks ou contextos), mantendo um arquivo principal como orquestrador.
- Evitar separacao excessivamente minuciosa sem beneficio real de manutencao.
- Quando uma mudanca alterar estrutura, fluxo de geracao ou convencoes, atualizar o `AGENTS.md` correspondente no mesmo ciclo de mudanca.
- Em mudancas full-stack, tratar backend + contrato + frontend como um fluxo unico (nao parar no meio).

## Scripts da raiz
Executar a partir da raiz:

- `pnpm dev`: roda apps em modo desenvolvimento via Turbo
- `pnpm build`: build das apps via Turbo
- `pnpm lint`: lint das apps via Turbo

## Integracao frontend <-> backend (visao global)
- A API expoe documentacao OpenAPI em `http://localhost:3333/docs/json` (definido em `apps/api/src/app.ts`).
- O frontend usa Kubb (`apps/web/kubb.config.ts`) para gerar client em `apps/web/src/http/generated`.
- O frontend usa `nuqs` para gerenciamento de filtros de listagem via query string.
- Mudancas no contrato da API (rotas, request/response, schemas) podem exigir:
- atualizacao do OpenAPI no backend
- regeneracao do client Kubb no frontend
- ajuste de hooks, paginas e formularios no frontend

## Regras de codigo gerado (globais)
- Nao editar manualmente `apps/web/src/http/generated/*` (gerado via Kubb).
- Nao editar manualmente `apps/web/src/route-tree.gen.ts` (gerado pelo fluxo de rotas do frontend).
- Nao editar manualmente `apps/api/generated/prisma/*` (gerado pelo Prisma).

## Fluxo recomendado por tipo de mudanca

### 1) Mudanca somente frontend
- Ler `apps/web/AGENTS.md`
- Identificar rota/pagina/componente/hook afetado
- Manter padrao de pastas e convencoes do frontend
- Se usar endpoint novo/alterado, validar dependencia com `apps/api/AGENTS.md`

### 2) Mudanca somente backend
- Ler `apps/api/AGENTS.md`
- Identificar dominio de rota e impacto em schema/Prisma
- Manter padrao de rotas, middleware e testes
- Se contrato mudar, registrar impacto no frontend

### 3) Mudanca full-stack
- Ler `apps/api/AGENTS.md` e `apps/web/AGENTS.md`
- Implementar/ajustar rota no backend
- Validar documentacao OpenAPI (`/docs/json`)
- Regenerar/adaptar integracao no frontend (Kubb + hooks + UI)
- Atualizar testes/documentacao conforme necessario

### 4) Mudanca somente mobile
- Ler `apps/mobile/AGENTS.md`
- Identificar rota/tela/componente/provider/hook afetado no Expo Router
- Manter padrao de pastas e convencoes do app mobile
- Validar integracao com contrato backend existente

## O que nao fazer
- Nao criar estrutura paralela para o mesmo dominio sem motivo.
- Nao misturar logica de dominio em pastas genericas se ja existe pasta de dominio.
- Nao editar arquivos gerados manualmente para "patch rapido".
- Nao assumir contratos de API no frontend sem validar o backend/OpenAPI.

## Manutencao desta documentacao
Atualize este arquivo quando houver:
- nova app/pasta estrutural relevante (ex.: `packages/*`, `apps/mobile`)
- mudanca na forma de integrar frontend e backend
- mudanca em scripts globais do monorepo
