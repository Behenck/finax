# AGENTS.md (apps/mobile)

## Objetivo
Definir convencoes do app mobile (`apps/mobile`) para manter consistencia com o monorepo `finax`.

## Stack
- React Native + Expo Router
- NativeWind (Tailwind CSS no React Native)
- TypeScript estrito
- Integracao HTTP com backend em `apps/api`

## Escopo
Estas regras valem para todo o diretorio `apps/mobile`.

## Estrutura recomendada
- `app/`: rotas do Expo Router
- `components/`: componentes visuais reutilizaveis
- `providers/`: providers globais (ex.: autenticacao)
- `hooks/`: hooks de dominio
- `lib/`: cliente HTTP, storage e utilitarios
- `types/`: tipos compartilhados locais do mobile

## Regras de implementacao
- Preservar roteamento por grupos do Expo Router (ex.: `(auth)`, `(app)`).
- Em componentes/telas novos ou alterados, usar Tailwind via `className` (NativeWind) como padrao.
- Fluxos de autenticacao devem refletir o contrato do backend (`/sessions/password`, `/auth/verify-otp`, `/sessions/refresh`, `/me`, etc.).
- Persistencia de token deve ser centralizada na camada de `lib`/provider, evitando duplicacao em telas.
- Em caso de alteracao de contrato de auth, alinhar tambem com `apps/api` e `apps/web`.
- Preferir componentes pequenos e reutilizaveis para formularios de autenticacao.
- Evitar `any`; tipar payloads e respostas da API.

## Variaveis e ambiente
- Priorizar `EXPO_PUBLIC_API_URL` para apontar a API em desenvolvimento.
- Sem variavel explicita, usar fallback local somente como conveniencia de dev.

## Metro/Monorepo
- Manter `metro.config.js` configurado para workspace (watchFolders, nodeModulesPaths e dedupe de React) para evitar erros de runtime por modulos duplicados.

## O que nao fazer
- Nao criar fluxo de auth paralelo desconectado do backend oficial.
- Nao hardcode de URL de API em varias telas/componentes.
- Nao acoplar regras de sessao diretamente nas telas quando ja houver provider.
