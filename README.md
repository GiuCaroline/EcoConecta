# EcoConecta — frontend com Expo Go, JavaScript e NativeWind

Aplicativo de reciclagem com uma experiência inspirada em apps de entrega: o usuário separa os materiais, agenda a retirada, um motorista parceiro transporta e o ponto de reciclagem confirma o recebimento.

Este projeto contém **somente frontend**, com navegação funcional, formulários, validações e dados salvos localmente. Todo o código do aplicativo está em JavaScript/JSX. O arquivo `global.css` contém somente as diretivas do Tailwind.

## Executar no celular

Pré-requisitos: Node.js 22.13 ou superior da linha 22 (ou Node 24.3+), npm e Expo Go atualizado para suportar o SDK 57.

1. Extraia o ZIP e abra a pasta `EcoConecta` no VS Code.
2. No terminal **dentro dessa pasta**, execute:

```bash
npm ci
npx expo start --clear
```

3. Deixe o computador e o celular na mesma rede Wi-Fi.
4. Abra o Expo Go e escaneie o QR Code. No iPhone, também pode usar a câmera.
5. Na tela inicial, toque em **Explorar demonstração**.

Você **não precisa** executar `create-expo-app`: o ZIP já contém o projeto completo e seu `package.json`.

Para a versão web de apoio:

```bash
npm run web
```

Se o celular informar incompatibilidade de SDK, atualize o Expo Go. Este projeto é SDK 57: não misture seu `package.json` com um projeto antigo de SDK 53.

## Telas e funcionalidades

| Área | Funcionalidades |
| --- | --- |
| Entrada | Boas-vindas, login e cadastro demonstrativos, seleção de perfil |
| Usuário | Home, categorias, busca por nome/endereço/material, pontos favoritos, detalhes do ponto |
| Solicitação | Formulário em três etapas, materiais, peso em kg, destino compatível, endereço, data, período, observações e revisão |
| Coletas | Listas em andamento/concluídas/canceladas, detalhes, linha do tempo e cancelamento antes do aceite |
| Motorista | Disponibilidade online/offline, pedidos disponíveis, aceite, rota em lista, retirada e entrega |
| Ponto | Cadastro, edição, materiais aceitos, horários, pausa de novas solicitações e confirmação de recebimento |
| Perfil | Edição do perfil e endereço, dados do veículo, troca de papel para testar o fluxo |
| Apoio | Notificações locais, guia de separação, ajuda e restauração dos exemplos |

Os pontos iniciais e contatos são fictícios. O peso é estimado e não representa medição real nem cálculo certificado de impacto.

## Testar um ciclo completo

1. Entre por **Explorar demonstração**.
2. Como usuário, toque em **Agendar minha coleta**.
3. Selecione Papel e Plástico, informe o peso e escolha Cooperativa Raiz Verde.
4. Informe uma data de hoje em diante no formato `DD/MM/AAAA` e confirme.
5. Vá à aba **Perfil** e selecione **Sou motorista**.
6. Em **Minha rota**, abra o pedido e toque em **Aceitar esta coleta**.
7. Confirme a retirada e depois a entrega ao ponto.
8. Vá a **Perfil** e selecione **Tenho um ponto**.
9. Abra o recebimento pendente e confirme. Na demonstração, os pontos fictícios pertencem a este perfil.
10. Volte ao papel **Quero reciclar** e veja o pedido em **Coletas → Concluídas**.

Para testar um ponto novo, cadastre-o no papel de ponto, alterne para usuário e solicite uma coleta com esse destino. As etapas seguintes funcionam da mesma forma.

Login/cadastro aceitam e-mail válido e senha de pelo menos 6 caracteres apenas para simular os formulários. A senha não é salva, verificada ou enviada. Não use uma senha pessoal. Para manter o perfil de demonstração com os exemplos, use o botão de exploração.

## Organização do código

| Arquivo/pasta | Responsabilidade |
| --- | --- |
| `App.js` | Providers, navegação por pilha, abas inferiores e seleção de telas por perfil |
| `src/components/UI.js` | Botões, campos, cards, ícones, chips, seleção de materiais e estrutura de páginas |
| `src/context/AppContext.js` | Estado compartilhado, AsyncStorage e operações de pedidos/pontos/perfis |
| `src/data/mock.js` | Materiais, papéis e dados de exemplo |
| `src/screens/Auth.js` | Entrada, login e cadastro |
| `src/screens/Home.js` | Home do usuário, painel do motorista e painel do ponto |
| `src/screens/Points.js` | Busca, detalhes e formulário de pontos |
| `src/screens/Requests.js` | Solicitação, listas e acompanhamento |
| `src/screens/Profile.js` | Perfil, notificações, guia e ajuda |
| `src/utils/domain.js` | Validações e regras de compatibilidade/etapas |
| `src/utils/feedback.js` | Diálogos compatíveis com mobile e web |
| `tailwind.config.js` | Cores, conteúdo e preset NativeWind |
| `babel.config.js`, `metro.config.js`, `global.css` | Configuração NativeWind v4 |

Para alterar cores, edite `forest`, `mint`, `lime`, `sand` e `ink` no Tailwind. Para criar uma tela, siga o padrão dos componentes exportados em `src/screens` e registre-a em `App.js`.

## Regras implementadas

- Uma coleta precisa ter ao menos um material, peso positivo, endereço e data válida.
- O destino precisa estar ativo e aceitar **todos** os materiais do pedido.
- Pedidos sem um destino que receba a combinação devem ser separados em coletas diferentes.
- Somente um pedido aguardando motorista pode ser cancelado pelo solicitante.
- Somente o motorista atribuído pode confirmar retirada e entrega.
- A entrega é concluída apenas quando o responsável pelo ponto confirma o recebimento.
- Pausar um ponto impede novos pedidos, mas mantém os existentes.
- O perfil do ponto edita somente locais vinculados à sua identidade.

## Dados locais e backend futuro

O estado fica na chave `@ecoconecta/frontend/v1` do AsyncStorage. Fechar e abrir o app preserva a sessão, pedidos, favoritos e pontos no mesmo aparelho. Para limpar os dados, use **Perfil → Restaurar dados de exemplo**.

Não há sincronização entre celulares. Login não é autenticação real. A tela quântica chama a API; os demais fluxos continuam locais. Não há mapa/GPS, cobrança, chat, upload de fotos ou push nesta entrega. A rota é uma lista de pedidos e o acompanhamento é atualizado manualmente.

Para integrar um backend, substitua em `AppContext.js` as operações `login`, `addRequest`, `cancelRequest`, `acceptRequest`, `advanceRequest` e `savePoint` por requisições à API. Essas mesmas regras devem ser verificadas no servidor: frontend não constitui controle de acesso.

## Verificação

```bash
npm test
npx expo export --platform all
```

Verificações realizadas: cinco testes de regras passaram, as dependências foram verificadas pelo Expo e a exportação compilou Android, iOS e web. O ciclo completo também foi exercitado na versão web em tamanho de celular: criação, persistência após recarregar, aceite, retirada, entrega e confirmação pelo ponto. O teste físico no Expo Go ainda deve ser feito no seu aparelho.

Capturas da versão web usadas na revisão visual:

![Tela inicial](docs/inicio.png)

![Acompanhamento da coleta](docs/acompanhamento.png)

![Coleta concluída](docs/conclusao.png)

## Usar em outro projeto Expo

Se quiser aproveitar somente as telas em um projeto existente, copie `src`, adapte `App.js` e instale React Navigation, AsyncStorage e ícones. Preserve as versões de React e React Native que correspondem ao SDK desse projeto. O setup do NativeWind deve usar v4 e Tailwind v3, com o preset de Babel e wrapper de Metro presentes neste ZIP. Para SDKs antigos com Reanimated 3, não adicione Worklets sem verificar a compatibilidade.

Documentação de referência:
- https://www.nativewind.dev/docs/getting-started/installation
- https://docs.expo.dev/more/create-expo/
- https://reactnavigation.org/docs/getting-started/

## Circuito quântico do grupo

Abra Perfil → Sou motorista → Início → Sugestão quântica de coletas. A tela compara dois candidatos e exibe os quatro estados, probabilidades e decisão. O circuito original está no backend em `quantum_service/circuit.py`; siga `QUANTUM.md` naquele projeto para iniciar o Python e o Node.

Copie `.env.example` para `.env`, configure EXPO_PUBLIC_API_URL com o IP do computador e reinicie o Expo. O modo Exemplo do grupo usa a API pública e reproduz π/4 e π com referência de 20 kg. A comparação de pedidos locais é identificada como demonstração. Para pedidos reais, integre AppContext ao backend e salve o token em SecureStore na chave `ecoconecta.session`.

O app permanece em JavaScript/NativeWind. PennyLane roda em Python no servidor. Não são realizadas ações automáticas sobre os pedidos. Trata-se de simulação educacional, sem cálculo de distâncias ou menor percurso. Os autores do grupo estão identificados na tela.


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
