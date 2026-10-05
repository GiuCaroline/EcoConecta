# Circuito quântico do EcoConecta

Autores: Daniel Pereira Rodrigues de Lima, Giulia Caroline Claro e João Victor da Silva Jardim.

O aplicativo JavaScript chama a API Node, que chama um serviço Python com PennyLane. O circuito original está em `quantum_service/circuit.py`: dois qubits, RX(urgência A), RX(urgência B), CNOT([0,1]) e qml.probs([0,1]). O `!pip install` era um comando de notebook; no projeto a instalação acontece pelo terminal.

## Preparar o serviço (Python 3.12)

Na pasta EcoConecta-Backend, depois de configurar o banco Neon conforme README.md:

```bash
python -m venv .venv-quantum
```

Windows PowerShell:

```powershell
.\.venv-quantum\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv-quantum/bin/activate
```

Instale as versões testadas:

```bash
python -m pip install -r quantum_service/requirements-lock.txt
```

Copie `.env.example` para `.env` caso ainda não exista. Preserve DATABASE_URL e as outras configurações do backend. Gere uma chave interna:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Cole o resultado em QUANTUM_API_KEY no `.env`. O Node e o Python leem o mesmo arquivo. Não coloque essa chave no aplicativo nem em variáveis EXPO_PUBLIC.

```dotenv
QUANTUM_API_URL=http://127.0.0.1:8001
QUANTUM_API_KEY=cole_a_chave_gerada_aqui
QUANTUM_REFERENCE_KG=20
QUANTUM_TIMEOUT_MS=10000
```

Terminal 1, com o ambiente Python ativado e na raiz do backend:

```bash
python -m uvicorn quantum_service.api:app --host 127.0.0.1 --port 8001
```

Terminal 2, na raiz do backend:

```bash
npm ci
npm run dev
```

Em servidores separados, configure a URL interna e o segredo em ambos os ambientes; proteja a conexão com HTTPS ou uma rede privada. O serviço Python é interno, não deve ser acessado diretamente pelo celular.

## Abrir no aplicativo

Na pasta do frontend EcoConecta, copie `.env.example` para `.env` e altere EXPO_PUBLIC_API_URL para o IP do computador na rede Wi-Fi (por exemplo http://192.168.0.100:3000). No celular, localhost significa o próprio celular. Permita a porta 3000 no firewall e use a mesma rede.

Terminal 3:

```bash
npm ci
npx expo start --clear
```

Abra Explorar demonstração → Perfil → Sou motorista → Início → Sugestão quântica de coletas. O modo Exemplo do grupo usa 5 kg e 20 kg. Com referência de 20 kg, esses pesos viram exatamente π/4 e π. Se alterar QUANTUM_REFERENCE_KG, o exemplo por pesos terá outros ângulos; `python -m quantum_service.demo` mantém os ângulos originais.

O frontend ainda usa dados locais para cadastro e coletas. Ao comparar pedidos locais, a tela identifica o modo demonstrativo. Para comparar pedidos reais, conecte AppContext à API conforme INTEGRACAO-EXPO.md e salve a sessão em expo-secure-store na chave `ecoconecta.session`. O endpoint protegido requer dois UUIDs reais e perfil driver; o servidor lê os pesos do banco. A demonstração pública funciona sem essa integração.

## API e regras

- POST /api/quantum/demo: `{ "volumeA": 5, "volumeB": 20 }`, sem sessão; limitado a demonstração, não lê nem modifica pedidos.
- POST /api/quantum/recommendation: `{ "requestIds": ["uuid-A", "uuid-B"] }`, Authorization: Bearer token; somente motorista, pedidos disponíveis ou aceitos por ele.
- Os estados são 00, 01, 10, 11. A resposta inclui probabilidades, ângulos, decisão e ordem consultiva.
- O peso é normalizado por `min(quantityKg / referenceKg, 1) * pi`. Essa conversão é uma escolha didática, não uma medição científica de urgência.
- Nenhum endpoint aceita, cancela ou altera a etapa das coletas. Não há nova tabela nem migração para o Neon.
- Serviço desligado gera erro 503; não há resultado inventado nem substituição silenciosa por outro algoritmo.

## Resultado original e limites

Com π/4 e π: [0, 0.8535533906, 0.1464466094, 0], portanto o estado escolhido é 01 (visitar B). As probabilidades correspondem aos resultados de medição do circuito; não são probabilidades de uma rota ser a melhor.

O default.qubit é um simulador clássico, sem hardware quântico. O circuito não contém distância, duração, capacidade do veículo, função de custo ou treinamento e não resolve o problema do menor percurso. A CNOT pode produzir emaranhamento, dependendo da entrada. Quando ambos os ângulos são π, o resultado é 10: não se deve interpretar a regra como uma prioridade logística universal. Para 11, começar pela maior urgência é uma regra clássica adicionada após o circuito.

## Verificar

Com o ambiente Python ativado:

```bash
python -m quantum_service.demo
python -m unittest quantum_service.test_circuit -v
npm run check
npm test
```

Foram aprovados 7 testes Python e 13 testes Node, incluindo chamadas reais Node → Python/PennyLane e controles de acesso no PostgreSQL de testes. Os testes Node da integração Python procuram `.venv-quantum` e são pulados se o ambiente não estiver instalado.

Referências: https://docs.pennylane.ai/en/stable/code/api/pennylane.devices.default_qubit.DefaultQubit.html e https://docs.pennylane.ai/en/stable/code/api/pennylane.probs.html.
