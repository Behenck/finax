# AGENTS.md (Frontend - `apps/web`)

## Objetivo
Definir a estrutura, stack e convencoes do frontend para orientar mudancas futuras de forma consistente com o codigo atual.

## Escopo de aplicacao
Aplica-se a tudo dentro de `apps/web`.

## Stack atual do frontend
- React 19 + TypeScript + Vite
- TanStack Router (rotas file-based com arquivos em `src/pages`)
- TanStack Query (queries/mutations e cache)
- React Hook Form + Zod (formularios e validacao)
- Tailwind CSS v4
- Radix UI / componentes estilo shadcn (`src/components/ui`)
- Axios (client em `src/lib/axios.ts`)
- Kubb (geracao de client HTTP/React Query a partir do OpenAPI)
- Sonner (toasts)
- Biome + ESLint (qualidade/lint)

## Entrypoints e arquivos-chave
- `src/main.tsx`: bootstrap React
- `src/App.tsx`: providers globais (TanStack Query, Router, Toaster, Devtools)
- `src/router.ts`: instancia do TanStack Router
- `src/route-tree.gen.ts`: arvore de rotas gerada (nao editar manualmente)
- `kubb.config.ts`: configuracao de geracao de client baseado no OpenAPI da API
- `src/lib/axios.ts`: instancia Axios com `VITE_API_URL`, cookies e header `Authorization`

## Estrutura de pastas (mapa pratico)
- `src/pages`: rotas/telas (padrao file-based)
- `src/pages/_auth`: fluxo de autenticacao
- `src/pages/_app`: area autenticada da aplicacao
- `src/pages/**/-components`: componentes colocalizados de uma rota/modulo
- `src/components`: componentes compartilhados
- `src/components/ui`: componentes base de UI (reutilizar antes de criar novos)
- `src/hooks`: hooks customizados por dominio/comportamento
- `src/hooks/auth`, `src/hooks/members`, `src/hooks/transactions`, etc.
- `src/http`: integracoes HTTP manuais e organizacao por dominio
- `src/http/generated`: client gerado por Kubb (nao editar manualmente)
- `src/schemas`: schemas de validacao (Zod) para formularios/entidades
- `src/errors`: normalizacao e resolucao de erros da API
- `src/lib`: bibliotecas compartilhadas (ex.: Axios)
- `src/utils`: funcoes utilitarias
- `src/context`: providers/contextos locais
- `src/assets`: assets estaticos

## Convencoes de implementacao

### Rotas e paginas
- Criar rotas usando `createFileRoute` dentro de `src/pages`.
- Seguir o padrao de agrupamento existente (`_auth`, `_app`, `layout.tsx`, `index.tsx`).
- Para componentes especificos de uma rota/modulo, preferir colocalizacao em `-components`.
- Nao editar `src/route-tree.gen.ts` manualmente.

### Estado de servidor (queries/mutations)
- Preferir encapsular chamadas de dados em hooks de dominio dentro de `src/hooks/*`.
- Usar TanStack Query para cache, invalidacao e estados async.
- Reaproveitar query keys/padroes existentes antes de criar novos nomes.

### Formularios e validacao
- Preferir `react-hook-form` + `zod` para formularios.
- Manter schemas proximos ao uso quando forem especificos da tela, ou em `src/schemas` quando compartilhados.
- Reaproveitar componentes de formulario em `src/components/ui` e padroes visuais existentes.

### UI e componentes
- Reaproveitar `src/components/ui` antes de criar novos componentes base.
- Componentes compartilhados devem ir para `src/components`.
- Componentes especificos de pagina/fluxo devem ficar colocalizados em `src/pages/**/-components`.
- Manter consistencia de classes Tailwind com o padrao existente no modulo.

### Imports e aliases
- Preferir alias `@/` para imports internos (configurado em `tsconfig.json`).
- Evitar caminhos relativos longos (`../../../../`) quando o alias resolver.

## HTTP, contrato de API e integracao com backend
- O frontend consome a API via:
- client Axios em `src/lib/axios.ts`
- client gerado em `src/http/generated` (Kubb)
- wrappers/funcoes por dominio em `src/http/*`
- hooks em `src/hooks/*`

- O Kubb usa `apps/web/kubb.config.ts` e aponta para `http://localhost:3333/docs/json`.
- Se o contrato da API mudar (request/response/schemas/rotas):
- regenerar client Kubb (com base em `kubb.config.ts`)
- revisar `src/http/*` e `src/hooks/*`
- adaptar paginas/formularios impactados

## Regras de codigo gerado (obrigatorio)
- Nao editar manualmente `src/http/generated/*`.
- Nao editar manualmente `src/route-tree.gen.ts`.
- Se precisar ajustar comportamento de chamada, prefira wrappers em `src/http/*` ou hooks em `src/hooks/*`.

## Padroes de mudanca (checklists)

### 1) Nova tela / nova rota
- Criar arquivo de rota em `src/pages` seguindo o padrao do grupo (`_auth` ou `_app`).
- Usar `createFileRoute`.
- Definir `head`/meta quando fizer sentido.
- Colocalizar componentes especificos em `-components` se a tela crescer.
- Se consumir dados, criar/ajustar hook em `src/hooks/<dominio>`.

### 2) Novo formulario
- Definir schema Zod.
- Integrar com `react-hook-form`.
- Reutilizar componentes de UI (`Input`, `Button`, `Field`, etc.) ja existentes.
- Tratar erro com padroes de `src/errors` quando houver chamada de API.
- Usar `toast` (Sonner) para feedback quando fizer sentido.

### 3) Nova integracao com endpoint
- Verificar se o endpoint ja existe no client gerado (`src/http/generated`).
- Se nao existir e depender de contrato novo, alinhar com backend e regenerar Kubb.
- Expor integracao em `src/http/<dominio>` quando necessario.
- Encapsular consumo em hook de dominio (`src/hooks/<dominio>`).
- Ajustar invalidacoes de cache (TanStack Query) conforme fluxo.

### 4) Ajuste visual em componente compartilhado
- Validar impacto em todas as telas que usam o componente.
- Preservar API publica do componente quando possivel.
- Se a mudanca for especifica de uma tela, nao alterar componente compartilhado sem necessidade.

## Estilo e qualidade
- Seguir padrao de formatacao do Biome (tabs e aspas duplas).
- Manter nomes e organizacao consistentes com o dominio afetado.
- Evitar refatoracoes estruturais em paralelo a uma mudanca funcional (a menos que seja solicitado).

## O que nao fazer
- Nao editar codigo gerado (`src/http/generated`, `src/route-tree.gen.ts`) manualmente.
- Nao criar hooks genericos quando ja existe pasta de dominio apropriada.
- Nao chamar endpoints diretamente em varios componentes se um hook de dominio resolver melhor.
- Nao duplicar schema/validacao se ja existe schema reutilizavel em `src/schemas`.

## Mudancas que cruzam fronteiras (frontend <-> backend)
- Sempre que uma mudanca no frontend depender de ajuste de contrato:
- consultar `apps/api/AGENTS.md`
- confirmar rota, schema e resposta no backend
- considerar regeneracao do client Kubb
- adaptar hooks/paginas apos a geracao

## Manutencao desta documentacao
Atualize este arquivo quando houver:
- nova convencao de rotas/pastas no frontend
- mudanca no fluxo de geracao Kubb
- mudanca relevante no client HTTP, estado global ou stack de formularios/UI

