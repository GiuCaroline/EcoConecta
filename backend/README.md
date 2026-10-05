# EcoConecta — backend JavaScript + PostgreSQL/Neon

API em Node.js/Express para o app EcoConecta. Foi construída considerando os campos e fluxos do repositório https://github.com/GiuCaroline/EcoConecta, principalmente `ecoConecta/src/context/AppContext.js` e suas telas.

## O que está implementado

- Cadastro de usuários (`resident`), motoristas (`driver`) e responsáveis pelos pontos (`point`).
- Login com senha protegida por bcrypt; sessão Bearer aleatória, revogável e com expiração.
- Perfil, veículo e disponibilidade do motorista.
- Cadastro/edição de pontos; busca por nome, endereço, material e favoritos.
- Solicitação de coleta com destino compatível, data, período, endereço e peso estimado.
- Aceite, retirada, entrega e confirmação de recebimento.
- Cancelamento antes do aceite, histórico de etapas e notificações por usuário.
- Transações e bloqueio de linha para impedir dois aceites no mesmo pedido.
- Paginação, validação de entrada, consultas parametrizadas e erros em português.

A API é funcional após você configurar seu banco. O Neon hospeda **o PostgreSQL**; a API Node roda separadamente, no seu computador ou numa hospedagem de Node.js.

## Passo a passo: criar o banco no Neon

1. Acesse https://console.neon.tech e entre/crie sua conta.
2. Clique em **New project / Create project**.
3. Dê o nome `EcoConecta`. Use uma versão PostgreSQL estável oferecida pelo painel, por exemplo 17 ou 18. Escolha a região mais próxima de onde a API será hospedada. Para começar, pode usar o plano gratuito se ele atender aos limites mostrados na sua conta.
4. Clique em **Create project** e aguarde a criação. O projeto terá uma branch inicial (selecione a disponível no painel) e um banco normalmente chamado `neondb`. Pode manter esse nome: o banco não precisa ter o mesmo nome do app.
5. Clique em **Connect**. Selecione a branch, o banco e o usuário/role de acesso ao PostgreSQL. Copie a conexão **pooled** para `DATABASE_URL` (ela tem `-pooler` no hostname).
6. Ainda em **Connect**, desligue a opção de pooling/copie a conexão direta para `DIRECT_DATABASE_URL`. As duas devem apontar para a **mesma branch e o mesmo banco**. Essa URL direta será usada para criar as tabelas.
7. Configure essas URLs no `.env` do backend e rode `npm run db:migrate` conforme a próxima seção. Isso cria as tabelas e os seis materiais iniciais.
8. Para conferir pelo site, vá a **SQL Editor** (em alguns layouts, **Postgres database → SQL Editor**), selecione a mesma branch e banco e execute:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT * FROM materials ORDER BY id;
```

Alternativa para criar tudo diretamente pelo site: antes de executar a migração, abra `db/001_initial.sql`, copie seu conteúdo para o SQL Editor de um banco **vazio** e execute envolvido por `BEGIN;` e `COMMIT;`. O script também registra a migração 001. Depois, `npm run db:migrate` reconhecerá que ela já foi aplicada.

Não execute o SQL inicial repetidamente: ele não apaga dados e dará erro se as tabelas já existirem. O comando de migração pode ser executado novamente e não reaplica a versão 001.

A URL contém senha. Ela fica somente no backend, em `.env`, que está ignorado pelo Git. Não a coloque no GitHub nem em `EXPO_PUBLIC_*` do app.

Referências oficiais: https://neon.com/docs/get-started/connect-neon, https://neon.com/docs/manage/projects, https://neon.com/docs/manage/query-with-neon-sql-editor.

## Executar o backend no Windows

Pré-requisitos: Node.js 22.13+ e npm. Extraia o ZIP, abra `EcoConecta-Backend` no VS Code e use o terminal dentro dessa pasta.

```bash
npm ci
```

Crie uma cópia de `.env.example` chamada `.env`. No Git Bash:

```bash
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

No arquivo `.env`, preencha as URLs copiadas do Neon. Exemplo **fictício**:

```dotenv
DATABASE_URL=postgresql://USUARIO:SENHA@ep-SEU-ENDPOINT-pooler.REGIAO.aws.neon.tech/neondb?sslmode=require
DIRECT_DATABASE_URL=postgresql://USUARIO:SENHA@ep-SEU-ENDPOINT.REGIAO.aws.neon.tech/neondb?sslmode=require
PORT=3000
HOST=0.0.0.0
APP_TIMEZONE=America/Sao_Paulo
SESSION_DAYS=7
BCRYPT_ROUNDS=12
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
TRUST_PROXY_HOPS=0
```

Não deixe os valores `USUARIO`, `SENHA` e `SEU-ENDPOINT`: substitua pela URL completa real fornecida pelo Neon. O backend configura TLS com verificação de certificado para conexões remotas, mesmo se a URL copiada contiver `sslmode=require`.

Crie as tabelas e inicie:

```bash
npm run db:migrate
npm run dev
```

Abra http://localhost:3000/health. O resultado esperado é:

```json
{ "status": "ok", "service": "ecoconecta-api" }
```

Para executar sem modo de observação: `npm start`. O script de migração não será executado automaticamente em cada inicialização.

## Estrutura

| Caminho                              | Responsabilidade                                        |
| ------------------------------------ | ------------------------------------------------------- |
| `src/server.js`                      | Inicialização, teste do banco e encerramento            |
| `src/app.js`                         | Rotas HTTP, middlewares e respostas                     |
| `src/auth.js`                        | Autenticação e sessões                                  |
| `src/requests.js`                    | Transições, permissões, histórico e notificações        |
| `src/validation.js`                  | Validações e datas civis no fuso de São Paulo           |
| `src/db.js`                          | Pool PostgreSQL, TLS e transações                       |
| `src/models.js`                      | Conversão de campos SQL para os nomes usados pelo front |
| `db/001_initial.sql`                 | Tabelas, índices e catálogo de materiais                |
| `scripts/migrate.js`                 | Aplicação única do esquema inicial                      |
| `tests/api.test.js`                  | Testes HTTP com PostgreSQL embutido                     |
| `mobile-example/api.js`              | Serviço opcional para integrar no Expo                  |
| `INTEGRACAO-EXPO.md`                 | Mudanças necessárias no contexto e nas telas            |
| `EcoConecta.postman_collection.json` | Coleção para testar o ciclo completo                    |

## Tabelas e dados

| Tabela              | Conteúdo                                 |
| ------------------- | ---------------------------------------- |
| `users`             | Usuários e seus perfis                   |
| `sessions`          | Hash dos tokens de sessão e expiração    |
| `materials`         | Catálogo dos seis materiais              |
| `points`            | Locais de reciclagem e materiais aceitos |
| `requests`          | Coletas e estado atual                   |
| `request_events`    | Histórico auditável das etapas           |
| `favorites`         | Relação usuário/ponto favoritado         |
| `notifications`     | Notificações dentro do app               |
| `schema_migrations` | Versões já aplicadas                     |

IDs são UUIDs. Os materiais aceitos e solicitados são arrays PostgreSQL de IDs (`paper`, `plastic`, `glass`, `metal`, `electronic`, `oil`) com restrições no banco. O peso é `numeric(10,2)` em kg e permanece **estimado**. O destino também é armazenado como snapshot do nome/endereço na coleta, preservando o registro se o ponto for editado.

O banco começa sem contas, pontos e coletas fictícios. Crie os três perfis pela API/Postman. Os exemplos locais do front não são importados automaticamente.

## Rotas

Todas as rotas abaixo têm prefixo `/api`, exceto `/health`. Só cadastro, login, catálogo de materiais e health são públicos; as demais exigem `Authorization: Bearer SEU_TOKEN`.

| Método | Rota                      | Função                                            |
| ------ | ------------------------- | ------------------------------------------------- |
| POST   | `/auth/register`          | Criar conta                                       |
| POST   | `/auth/login`             | Entrar                                            |
| POST   | `/auth/logout`            | Revogar a sessão atual                            |
| GET    | `/auth/me`                | Consultar perfil da sessão                        |
| PATCH  | `/users/me`               | Atualizar dados permitidos do próprio perfil      |
| GET    | `/materials`              | Catálogo de materiais                             |
| GET    | `/points`                 | Listar/buscar pontos                              |
| GET    | `/points/mine`            | Pontos do responsável autenticado                 |
| GET    | `/points/:id`             | Detalhes de um ponto                              |
| POST   | `/points`                 | Criar ponto (`point`)                             |
| PATCH  | `/points/:id`             | Editar ponto próprio (`point`)                    |
| GET    | `/favorites`              | IDs dos pontos favoritos                          |
| PUT    | `/favorites/:id`          | Adicionar favorito, de modo idempotente           |
| DELETE | `/favorites/:id`          | Remover favorito                                  |
| POST   | `/requests`               | Solicitar coleta (`resident`)                     |
| GET    | `/requests`               | Coletas vinculadas à conta                        |
| GET    | `/requests/available`     | Pedidos disponíveis (`driver`)                    |
| GET    | `/requests/:id`           | Detalhes autorizados de uma coleta                |
| GET    | `/requests/:id/events`    | Histórico para os envolvidos                      |
| POST   | `/requests/:id/accept`    | Aceitar (`driver` online)                         |
| POST   | `/requests/:id/pickup`    | Confirmar retirada (`driver` atribuído)           |
| POST   | `/requests/:id/deliver`   | Confirmar entrega (`driver` atribuído)            |
| POST   | `/requests/:id/receive`   | Confirmar recebimento (`point` proprietário)      |
| POST   | `/requests/:id/cancel`    | Cancelar antes do aceite (`resident` solicitante) |
| GET    | `/notifications`          | Notificações da conta                             |
| PATCH  | `/notifications/read-all` | Marcar como lidas                                 |

Listagens: `?limit=50&offset=0`, no máximo 100 por página. Retorno: `{ "items": [], "hasMore": false, "nextOffset": null }`. Busca de pontos: `?search=Maua&material=paper&active=true&favorites=true`. Todos os filtros são opcionais.

Estado de coleta compatível com `STEPS` do front:

| Status | Etapa                | Quem atualiza               |
| ------ | -------------------- | --------------------------- |
| 0      | Aguardando motorista | Criado pelo usuário         |
| 1      | Motorista a caminho  | Motorista aceita            |
| 2      | Material coletado    | Motorista confirma retirada |
| 3      | Entregue ao ponto    | Motorista confirma entrega  |
| 4      | Concluída            | Ponto confirma recebimento  |

Cancelamento usa `cancelled: true`, somente na etapa 0. Não há endpoint para gravar `status`, `residentId`, `driverId` ou `owner` arbitrariamente. Essas informações vêm da sessão e das transições autorizadas.

O motorista ainda não atribuído recebe endereço oculto e apenas o primeiro nome do solicitante. O endereço completo e as observações ficam disponíveis após o aceite. Um ponto pausado não aceita novos pedidos, mas seus pedidos existentes continuam válidos.

## Exemplos JSON

Cadastro (`POST /api/auth/register`):

```json
{
  "name": "Giulia",
  "email": "giulia@exemplo.com",
  "password": "UmaSenhaDeTeste123!",
  "role": "resident",
  "phone": "11999999999",
  "address": "Rua Exemplo 100, Centro, Mauá"
}
```

Senha: mínimo 8 caracteres e máximo 72 bytes, respeitando o limite do bcrypt. A resposta contém `{ "user": {...}, "token": "...", "expiresAt": "..." }`. A senha/hash nunca retornam à aplicação. O token é opaco, não é JWT: não precisa de `JWT_SECRET`. Sua versão SHA-256 fica no banco e o valor original vai somente para o cliente autenticado.

Cadastro de ponto (`POST /api/points`, com token de `point`):

```json
{
  "name": "Cooperativa Novo Ciclo",
  "address": "Rua Destino 200, Centro, Mauá",
  "phone": "11999999999",
  "hours": "Seg a sex, 08h às 17h",
  "description": "Recebemos materiais recicláveis separados.",
  "materials": ["paper", "plastic", "metal"],
  "active": true
}
```

Coleta (`POST /api/requests`, com token de `resident`):

```json
{
  "pointId": "UUID retornado no cadastro do ponto",
  "materials": ["paper", "plastic"],
  "quantity": 4.5,
  "date": "31/12/2026",
  "period": "Manhã · 08h–12h",
  "address": "Rua Exemplo 100, Centro, Mauá",
  "notes": "Interfone 12"
}
```

Use uma data atual/futura no momento do teste. A API aceita `DD/MM/AAAA` ou `AAAA-MM-DD`, verifica dias impossíveis e compara com a data atual em `APP_TIMEZONE`. `quantity` aceita número ou texto como `"4,5"`, com até duas casas decimais.

## Testar pelo Postman

Importe `EcoConecta.postman_collection.json`. A variável `baseUrl` começa como `http://localhost:3000`. As requisições estão ordenadas para criar três contas, cadastrar um ponto, solicitar uma coleta e avançar as etapas. Os scripts guardam os tokens/IDs na coleção. Ao importar, `runId` e `pickupDate` são criados automaticamente pela primeira requisição de cadastro; execute na ordem. Nenhuma senha de conta real vem no pacote.

## Validação e limites desta entrega

Execute:

```bash
npm test
npm run check
```

Os testes usam PGlite (PostgreSQL embutido em WASM), sem necessidade de suas credenciais Neon. Exercitam API HTTP, esquema, autenticação, expiração/revogação, papéis, ponto pausado, materiais, datas, peso, disputa de aceite, transições, cancelamento, histórico, notificações e paginação. Não substituem uma verificação da conectividade e da migração **no seu projeto Neon**.

Esta é uma base de backend para o MVP. Cadastro de motorista/ponto é aberto por perfil; não existe aprovação administrativa. Também não há verificação de e-mail, recuperação de senha, mapa/GPS, cálculo de frete, pagamento, upload de fotos ou push. Notificações são registros consultados pela API. As etapas não garantem um horário reservado de coleta.

Ao publicar a API, use HTTPS, configure as variáveis no provedor e ajuste `TRUST_PROXY_HOPS` conforme a cadeia de proxies documentada pelo host (não ative confiança irrestrita). O rate-limit atual é em memória por processo: se tiver múltiplas instâncias, use um store compartilhado antes de escalar. Não configure `.env` no frontend para acessar o banco diretamente.

## Módulo quântico

A entrega inclui o circuito original do grupo em `quantum_service/circuit.py`, serviço Python interno e endpoints demonstrativo e protegido. Siga [QUANTUM.md](QUANTUM.md) para instalar, configurar e executar com o aplicativo. O módulo usa o simulador PennyLane e não calcula o menor percurso. Nenhuma migração adicional no Neon é necessária.
