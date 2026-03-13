# AGENTS.md (Mobile - `apps/mobile`)

## Objetivo
Definir estrutura, stack e convencoes do app mobile para manter consistencia com o monorepo `finax` e com o frontend web (`apps/web`).

## Escopo de aplicacao
Aplica-se a tudo dentro de `apps/mobile`.

## Stack oficial do mobile
- React Native + Expo + Expo Router
- TypeScript estrito
- NativeWind (Tailwind via `className`)
- TanStack Query (cache, invalidacao e estado assincrono)
- React Hook Form + Zod (formularios)
- Axios
- Kubb (geracao de client HTTP a partir do OpenAPI da API), alinhado com o web

## Diretriz principal de alinhamento com o web
- Toda feature nova no mobile deve seguir a referencia de dominio/fluxo do web.
- Sempre consultar primeiro a implementacao equivalente em `apps/web` antes de criar telas, rotas, hooks e servicos.
- Estrutura de navegacao, nomes de modulos e separacao por dominio devem espelhar o web quando fizer sentido.
- Layout e hierarquia visual do mobile devem refletir a intencao do web, adaptando para UX mobile sem alterar semantica do fluxo.

## Estrutura de pastas recomendada
- `app/`: rotas do Expo Router (ex.: `(auth)`, `(app)`, `registers/*`)
- `components/`: componentes visuais reutilizaveis
- `components/navigation/`: tabs, header actions e navegacao autenticada
- `components/registers/`: formularios e blocos de UI de cadastros
- `providers/`: providers globais (auth, query client etc.)
- `hooks/`: hooks de dominio e hooks auxiliares
- `lib/`: API client, storage, utilitarios, camada HTTP por dominio
- `lib/registers/`: query keys, schemas, mapeadores e servicos de cadastros
- `types/`: tipos locais compartilhados do mobile

## Roteamento e layout
- Preservar grupos de rota do Expo Router:
- `/(auth)` para telas publicas
- `/(app)` para area autenticada
- Na area autenticada, usar `Bottom Tabs` (5 abas principais) e manter arquitetura equivalente ao web:
- dashboard
- cadastros
- vendas (acao central)
- comissoes
- configuracoes
- Rotas fora da barra principal (ex.: `transacoes`) podem existir como auxiliares/placeholder e nao precisam virar aba.
- Para fluxos internos com criacao/edicao (ex.: `registers/*`), usar `Stack` dentro da aba para manter navegacao hierarquica.
- Modulos nao implementados ainda devem permanecer visiveis como placeholder "Em breve".

## Regras de UI
- Em componentes/telas novos ou alterados, usar NativeWind via `className` como padrao.
- Evitar mistura de estilos inline grandes quando `className` resolver.
- Reaproveitar componentes base (`AppScreen`, `PageHeader`, botoes, campos de formulario) antes de criar variacoes novas.
- Manter consistencia visual com o web, adaptando para mobile:
- espacamentos
- hierarquia de titulos
- agrupamento de acoes

## Estado de servidor e formularios
- Encapsular chamadas de dados em servicos/hooks de dominio.
- Usar TanStack Query para cache e invalidacao.
- Padronizar query keys por dominio (ex.: `registers/*`) e invalidar listas apos create/update/delete.
- Usar React Hook Form + Zod em formularios de dominio.
- Evitar `any`; tipar payload e resposta de forma explicita.

## Kubb no mobile (obrigatorio para contratos de API)
- Seguir a mesma estrategia do web para contrato HTTP:
- fonte de verdade: OpenAPI em `http://localhost:3333/docs/json`
- geracao automatica de client com Kubb
- Nao editar manualmente arquivos gerados do Kubb.
- Se o contrato da API mudar:
- regenerar client Kubb
- ajustar wrappers/hooks no mobile
- revisar telas afetadas
- Sempre preferir usar tipos gerados do contrato em vez de tipos manuais quando houver equivalencia.

## Integracao com backend
- O mobile deve consumir endpoints oficiais de `apps/api`.
- Evitar "adivinhar" contrato de rota; validar com OpenAPI.
- Em mudancas que impactem contrato, alinhar com `apps/api` e `apps/web` no mesmo ciclo.

## Autenticacao e sessao
- Fluxos de auth devem refletir o backend (`/sessions/password`, `/auth/verify-otp`, `/sessions/refresh`, `/me` etc.).
- Persistencia de token deve ficar centralizada em `lib` + provider.
- Nao duplicar regras de sessao dentro de telas.
- Logout deve ser consistente e funcionar em qualquer tela autenticada.

## Variaveis de ambiente
- Priorizar `EXPO_PUBLIC_API_URL` para apontar a API no desenvolvimento.
- Sem variavel explicita, usar fallback local somente como conveniencia.

## Metro e monorepo
- Manter `metro.config.js` preparado para workspace:
- `watchFolders`
- `nodeModulesPaths`
- dedupe de React
- Evitar aliases/shims que gerem ciclos de dependencia no runtime.

## Regras de codigo gerado
- Nao editar manualmente codigo gerado por Kubb.
- Nao criar "patch" em arquivo gerado para ajuste rapido.
- Ajustes devem ser feitos em wrappers/hooks proprios fora da pasta gerada.

## Checklists de mudanca

### 1) Nova tela/rota mobile
- Validar referencia equivalente no web.
- Criar rota no grupo correto do Expo Router.
- Garantir estado de auth e navegacao coerentes.
- Reaproveitar componentes base e padroes visuais.

### 2) Novo formulario
- Definir schema Zod.
- Integrar com RHF.
- Tratar erros de API com mensagem amigavel.
- Garantir invalidacao de cache apos mutacao.

### 3) Nova integracao de endpoint
- Validar contrato no OpenAPI.
- Gerar/atualizar client Kubb.
- Expor wrapper de dominio no mobile.
- Conectar com Query/Mutation e invalidacao.

### 4) Mudanca full-stack (api + web + mobile)
- Atualizar backend.
- Validar `/docs/json`.
- Regenerar Kubb.
- Ajustar web e mobile no mesmo ciclo.

## O que nao fazer
- Nao criar fluxo paralelo desconectado do backend oficial.
- Nao hardcode de base URL em multiplos arquivos.
- Nao quebrar padrao de layout/estrutura do web sem justificativa de UX mobile.
- Nao manter endpoint manual quando ja existir geracao/tipo via Kubb.
- Nao editar arquivos gerados.

## Manutencao deste arquivo
Atualizar este documento quando houver:
- mudanca de stack do mobile
- mudanca no fluxo Kubb/OpenAPI no mobile
- mudanca relevante de estrutura de rotas/layout
- nova convencao de componentes compartilhados
