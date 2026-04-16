# Deploy no Easypanel

Este guia registra o deploy de producao do Finax no Easypanel usando servicos separados para banco, API, web e Adminer.

## Servicos

Crie um projeto chamado `finax` no Easypanel com estes servicos:

| Servico | Tipo | Origem | Porta interna | Dominio |
| --- | --- | --- | --- | --- |
| `finax-db` | Postgres Service | Postgres 16 | 5432 | sem dominio publico |
| `finax-api` | App Service | `https://github.com/Behenck/finax`, branch `main`, Dockerfile `apps/api/Dockerfile` | 3333 | `https://api.k6ure7.easypanel.host` |
| `finax-web` | App Service | `https://github.com/Behenck/finax`, branch `main`, Dockerfile `apps/web/Dockerfile` | 80 | `https://app.k6ure7.easypanel.host` |
| `finax-adminer` | Template Adminer ou imagem `adminer:latest` | imagem publica | 8080 | `https://dbadmin.k6ure7.easypanel.host` |

Nao suba Portainer para este projeto. O Easypanel ja deve ser o painel principal de servicos, deploy, dominios, logs e volumes.

## Variaveis

Use os exemplos em:

- `deploy/easypanel/api.env.example`
- `deploy/easypanel/web.env.example`
- `deploy/easypanel/adminer.env.example`

No web, `VITE_API_URL` precisa estar tambem como build arg, porque o Vite grava esse valor no bundle durante o build.

Gere valores fortes para:

- senha do Postgres
- `JWT_SECRET`
- segredos do Google OAuth, se o login Google for usado
- `RESEND_API_KEY`, se envio de email for usado

## Ordem de criacao

1. Conecte o GitHub ao Easypanel e autorize acesso ao repositorio privado `Behenck/finax`.
2. Crie o projeto `finax`.
3. Crie `finax-db` como Postgres Service com database `finax`, user `finax` e senha forte.
4. Copie a connection string interna do Postgres para montar `DATABASE_URL` da API.
5. Crie `finax-api` como App Service usando `apps/api/Dockerfile`, branch `main`, porta interna `3333` e dominio `api.k6ure7.easypanel.host`.
6. Configure as variaveis da API e faca deploy.
7. Valide `https://api.k6ure7.easypanel.host/health` e `https://api.k6ure7.easypanel.host/docs/json`.
8. Crie `finax-web` como App Service usando `apps/web/Dockerfile`, branch `main`, porta interna `80` e dominio `app.k6ure7.easypanel.host`.
9. Configure `VITE_API_URL` como env e build arg no web e faca deploy.
10. Valide `https://app.k6ure7.easypanel.host/health` e a tela de login.
11. Crie `finax-adminer` com porta interna `8080` e dominio `dbadmin.k6ure7.easypanel.host`.

## Adminer

No login do Adminer, use:

- System: `PostgreSQL`
- Server: host interno do `finax-db` no Easypanel
- Username: `finax`
- Password: senha do Postgres
- Database: `finax`

Mantenha o Adminer protegido. Para reduzir superficie de ataque, desligue o servico quando nao estiver usando.

## Checklist de validacao

- API responde `200` em `/health`.
- API expoe OpenAPI em `/docs/json`.
- Web responde `200` em `/health`.
- Tela de login carrega em `https://app.k6ure7.easypanel.host`.
- No navegador, as chamadas HTTP saem para `https://api.k6ure7.easypanel.host`.
- A API iniciou sem erro de `prisma migrate deploy`.
- Adminer conecta no Postgres usando o host interno.
- Se Google OAuth estiver ativo, o callback no Google Console e `GOOGLE_CALLBACK_URL` sao exatamente `https://api.k6ure7.easypanel.host/sessions/google/callback`.

## Backup

Ative backups do Postgres para um destino S3 compativel se o plano do Easypanel permitir. Se o recurso nao estiver disponivel, configure uma rotina externa de `pg_dump` para S3/R2/Spaces/MinIO.

Antes de confiar no backup automatico, faca pelo menos um teste de restore em ambiente separado.
