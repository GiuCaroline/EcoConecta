# 🌱 EcoConecta

Plataforma digital colaborativa multiplataforma (mobile e web) voltada à facilitação da reciclagem comunitária e da logística reversa na região do **Grande ABC Paulista**, conectando **moradores/geradores**, **motoristas coletores parceiros** e **pontos de coleta/cooperativas**.

---

## 👥 Autores & Orientação

- **Integrantes do Projeto:**
  - **Daniel Pereira Rodrigues de Lima** — Pesquisa, Modelagem e Documentação ([GitHub](https://github.com/daniel-prlima))
  - **Giulia Caroline Claro** — Desenvolvimento Full Stack (Mobile e API) ([GitHub](https://github.com/GiuCaroline))
  - **João Victor da Silva Jardim** — Arquitetura em Nuvem e FinOps
- **Docente Orientador:**
  - **Prof. Dr. Bruno Zolotareff dos Santos** — Faculdade de Tecnologia de Mauá (**Fatec Mauá** — Centro Paula Souza)

---

## 🏗️ Arquitetura Implementada

- **Aplicação Cliente (`ecoConecta/`):** React 19, React Native 0.86, Expo SDK 57, React Navigation v7, NativeWind / TailwindCSS e Expo SecureStore.
- **API RESTful (`backend/`):** Node.js + Express, autenticação via sessões persistidas no PostgreSQL (`sessions` + `bcryptjs`), suporte dual-mode para **PGlite** (PostgreSQL embutido local) ou **Neon Serverless PostgreSQL** via `DATABASE_URL`.
- **Módulo Quântico Experimental (`backend/quantum/`):** Circuito variacional de 2 qubits em **Python + PennyLane** (`default.qubit`), com fallback analítico equivalente em Node.js caso o ambiente não possua o pacote instalado.

---

## 🚀 Guia de Execução Local Rápida

### Pré-requisitos
- **Node.js** v20+ ou v22+
- **Python 3** (opcional: instale `pip install pennylane` para rodar no simulador `default.qubit`; sem ele o backend usa o fallback analítico equivalente)
- Aplicativo **Expo Go** (Android/iOS) ou navegador web

### 1. Iniciar o Backend (`backend/`)
> Sem `DATABASE_URL`, o servidor sobe automaticamente com **PGlite** local (em `backend/.pglite`) e executa o *seed* inicial com os pontos do ABC Paulista e as contas de teste.

```bash
cd backend
npm install
npm start
# API disponível em http://localhost:3000
```

### 2. Iniciar o Aplicativo (`ecoConecta/`)
Configure o arquivo `ecoConecta/.env` (use `ecoConecta/.env.example` como base):
```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```
*(Se testar no celular físico via Expo Go na mesma rede Wi-Fi, substitua `localhost` pelo IP da sua máquina na rede local).*

```bash
cd ecoConecta
npm install
npx expo start
```
Pressione `w` para abrir na Web ou escaneie o QR Code com o **Expo Go**.

---

## 🔑 Credenciais das Contas de Teste (Seed)

O servidor cria automaticamente três contas de demonstração na primeira inicialização (senha padrão para todas: **`EcoConecta123`**):

| Perfil | E-mail | Senha |
|---|---|---|
| **Morador / Gerador** | `giulia@ecoconecta.com` | `EcoConecta123` |
| **Motorista Coletor** | `motorista@ecoconecta.com` | `EcoConecta123` |
| **Ponto de Coleta / Cooperativa** | `ponto@ecoconecta.com` | `EcoConecta123` |

---

## 📦 Ciclo de Coleta em 5 Etapas & Privacidade de Endereço

O acompanhamento das retiradas segue cinco estados rastreáveis para 6 categorias de resíduos (**Papel, Plástico, Vidro, Metal, Eletrônicos e Óleo**):

1. **`0` — Aguardando motorista:** Pedido criado pelo morador; disponível para aceite dos motoristas parceiros.
2. **`1` — Motorista a caminho:** Motorista aceitou a coleta (`POST /api/requests/:id/accept`).
3. **`2` — Material coletado:** Motorista confirmou a retirada no endereço (`POST /api/requests/:id/pickup`).
4. **`3` — Entregue ao ponto:** Motorista registrou a entrega na cooperativa/ecoponto (`POST /api/requests/:id/deliver`).
5. **`4` — Concluída:** Responsável pelo ponto confirmou o recebimento físico (`POST /api/requests/:id/receive`).

### 🛡️ Privacidade de Endereço
Enquanto a solicitação está na etapa `0` (`Aguardando motorista`), o endereço completo do morador é **mascarado** para os motoristas (`"Endereço completo disponível após aceitar a coleta"`). O endereço e as observações só são revelados após o aceite formal pelo motorista.

---

## ⚛️ Otimização Experimental com PennyLane (2 Qubits)

O módulo [`backend/quantum/circuit.py`](backend/quantum/circuit.py) implementa um circuito variacional de 2 qubits no dispositivo `default.qubit`:
- Converte os pesos estimados (em kg) de duas coletas candidatas A e B em ângulos de rotação: $\theta = (\text{peso} / 20) \times \pi$ (referência padrão de `20 kg`).
- Aplica portas `RX(A, wires=0)`, `RX(B, wires=1)` e emaranhamento `CNOT(wires=[0, 1])`, retornando `qml.probs(wires=[0, 1])` para os estados `["00", "01", "10", "11"]`.
- Endpoints:
  - `POST /api/quantum/demo` (público, ex.: `{ "volumeA": 5, "volumeB": 20 }`)
  - `POST /api/quantum/recommendation` (autenticado, recebe `{ "requestIds": ["uuidA", "uuidB"] }`)

---

## 🧪 Testes Automatizados & Lint

Com as dependências instaladas em `backend/` e `ecoConecta/`, execute na pasta `ecoConecta/`:

```bash
cd ecoConecta
npm test
npm run lint
```

A suíte (`node --test tests/*.test.mjs`) valida regras de domínio, integração completa Cliente → API → PostgreSQL (`PGlite`) e as rotas quânticas.

---

## ☁️ Instruções de Deploy Gratuito (Neon + Render)

### 1. Banco de Dados PostgreSQL no Neon
1. Acesse [Neon.tech](https://neon.tech) e crie um projeto gratuito PostgreSQL.
2. Copie a connection string (`postgresql://<user>:<password>@<host>/<dbname>?sslmode=require`).

### 2. API Backend no Render
1. Conecte o repositório GitHub ao [Render.com](https://render.com) — o arquivo `render.yaml` na raiz já configura o serviço `ecoconecta-api` (`rootDir: backend`).
2. Nas variáveis de ambiente do serviço no Render, configure:
   - `DATABASE_URL`: a connection string do Neon.
   - `CORS_ORIGINS`: (opcional) URLs permitidas separadas por vírgula.
3. Ao subir, o servidor executa automaticamente `backend/db/001_initial.sql` e o seed inicial caso o banco esteja vazio.
4. No aplicativo (`ecoConecta/.env`), atualize `EXPO_PUBLIC_API_URL` para a URL gerada no Render.
