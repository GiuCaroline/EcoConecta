# Como ligar o frontend atual à API

O ZIP entrega a API pronta e um serviço de chamadas para o app. O frontend em `GiuCaroline/EcoConecta` ainda é o protótipo local: não basta iniciar o backend para ele deixar de usar AsyncStorage/mock. Esta integração é uma etapa separada; os exemplos abaixo mostram onde alterar.

## 1. Configure a rede

Inicie a API com `npm run dev`. No Windows, rode `ipconfig` e veja o **Endereço IPv4** do adaptador Wi-Fi ativo. Exemplo: `192.168.0.100`.

No celular, abra `http://192.168.0.100:3000/health`. O telefone e o computador devem estar na mesma rede. Caso não abra, confira a regra de entrada da porta TCP 3000 no firewall e se a rede permite comunicação entre dispositivos. O backend já escuta em `0.0.0.0`.

No arquivo **ecoConecta/.env** do frontend, coloque apenas:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.0.100:3000
```

No celular físico, `localhost` seria o próprio telefone. No emulador Android padrão, o endereço do computador costuma ser `10.0.2.2`. Em produção, use a URL HTTPS da hospedagem da API.

O túnel do Expo/Metro não publica automaticamente a API Node. São serviços separados.

**Nunca coloque DATABASE_URL no app.** Variáveis `EXPO_PUBLIC_*` ficam visíveis no bundle.

## 2. Instale o armazenamento de sessão

Dentro de `ecoConecta`:

```bash
npx expo install expo-secure-store
```

Copie `mobile-example/api.js` para `ecoConecta/src/services/api.js` e reinicie/recarregue o Expo. O serviço foi pensado para Android/iOS; SecureStore não tem suporte web. Para uma versão web futura, adote um fluxo de sessão adequado ao navegador em vez de copiar o token para localStorage.

Esse arquivo fornece login/cadastro, armazenamento do token, timeout, erros em português, paginação e chamadas para as operações da API. Ele não altera o estado React por conta própria.

## 3. Substitua o estado demonstrativo do AppContext

No `src/context/AppContext.js`, importe:

```javascript
import * as api from "../services/api";
```

Comece sem mock:

```javascript
const emptyState = {
  user: null,
  points: [],
  requests: [],
  favorites: [],
  notifications: [],
};
```

Remova o carregamento/salvamento do estado inteiro na chave `@ecoconecta/frontend/v1`. Ela contém dados da simulação. Use os dados do servidor como fonte da verdade. A sessão será guardada no SecureStore pelo serviço.

Dentro do provider, um carregamento básico pode ser:

```javascript
async function refresh() {
  const data = await api.loadAppData();
  setState(data);
  return data;
}

useEffect(() => {
  let active = true;
  api.setSessionExpiredHandler(() => {
    if (active) setState(emptyState);
  });

  async function initialize() {
    try {
      if (await api.getSessionToken()) {
        const data = await api.loadAppData();
        if (active) setState(data);
      }
    } catch (error) {
      if (active) Feedback.alert("Conexão com a API", error.message);
    } finally {
      if (active) setReady(true);
    }
  }

  initialize();
  return () => {
    active = false;
    api.setSessionExpiredHandler(() => {});
  };
}, []);
```

Não transforme erro de conexão em login fictício. Uma resposta 401 remove o token e deve levar o usuário de volta à entrada; erro de rede deve ser mostrado e permitir tentar novamente.

Substitua as funções do contexto por operações assíncronas. Exemplo de login/cadastro:

```javascript
async function login(email, password) {
  await api.login(email, password);
  await refresh();
}

async function register(input) {
  await api.register(input);
  await refresh();
}

async function logout() {
  await api.logout();
  setState(emptyState);
}
```

Exemplo de criação de coleta, usando a resposta real antes de navegar:

```javascript
async function addRequest(values) {
  const created = await api.createRequest({
    pointId: values.pointId,
    materials: values.materials,
    quantity: values.quantity,
    date: values.date,
    period: values.period,
    address: values.address,
    notes: values.notes || "",
  });
  setState((current) => ({
    ...current,
    requests: [created, ...current.requests],
  }));
  return created.id;
}
```

A API devolve UUID. Não use `EC-${Date.now()}` como identificação real nem continue navegando antes da resposta.

Exemplo de transições:

```javascript
function storeRequest(updated) {
  setState((current) => ({
    ...current,
    requests: current.requests.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  }));
}

async function acceptRequest(id) {
  storeRequest(await api.acceptRequest(id));
}

async function cancelRequest(id) {
  storeRequest(await api.cancelRequest(id));
}

async function advanceRequest(id) {
  const current = state.requests.find((item) => item.id === id);
  if (!current) throw new Error("Atualize a lista de coletas.");

  let updated;
  if (state.user.role === "driver" && current.status === 1) {
    updated = await api.pickupRequest(id);
  } else if (state.user.role === "driver" && current.status === 2) {
    updated = await api.deliverRequest(id);
  } else if (state.user.role === "point" && current.status === 3) {
    updated = await api.receiveRequest(id);
  } else {
    throw new Error("Esta etapa não está disponível para seu perfil.");
  }
  storeRequest(updated);
}
```

Mesmo com a escolha feita no front, a API também verifica a etapa e o proprietário/motorista atribuído. Se retornar 409, recarregue o pedido; uma segunda retirada não deve avançar automaticamente para entrega.

Mapeamento das demais operações:

| Função atual | Chamada ao servidor                     | Atualização de estado                                 |
| ------------ | --------------------------------------- | ----------------------------------------------------- |
| `updateUser` | `api.updateUser(camposPermitidos)`      | Substituir `state.user` pela resposta                 |
| `favorite`   | `api.setFavorite(id, !jaFavoritado)`    | Atualizar `favorites` só após sucesso                 |
| `savePoint`  | `api.savePoint(camposDoFormulario, id)` | Inserir/substituir ponto e retornar o ID real         |
| `markRead`   | `api.markNotificationsRead()`           | Marcar as notificações locais como lidas após sucesso |
| `refresh`    | `api.loadAppData()`                     | Recarregar os dados autorizados                       |

Para `savePoint`, envie apenas `name`, `address`, `phone`, `hours`, `description`, `materials` e `active`. O formulário de edição atual pode conter também `id`, `owner` e `icon`; remova esses campos antes da chamada, pois o servidor rejeita campos extras.

Para `updateUser`, envie somente `name`, `phone` e `address` de moradores/pontos. Acrescente `vehicle`, `plate` e `online` apenas para motorista. O formulário atual inicializa `vehicle` e `plate` mesmo em outros perfis: não envie esses campos vazios para usuário/ponto. Nunca envie `role`, `id`, `email` ou senha por esse PATCH.

`ownedPoints` passa a ser:

```javascript
const ownedPoints = state.points.filter(
  (point) => point.owner === state.user?.id,
);
```

Remova a condição especial `demo-point`. O servidor define o proprietário pelo token.

## 4. Atualize os formulários e chamadas das telas

Em `src/screens/Auth.js`, o login precisa receber e-mail/senha, e o cadastro chama `register`. Não monte um objeto `local:${email}`.

```javascript
async function submit() {
  // Mantenha validações locais. Mínimo de senha passa a ser 8 caracteres.
  try {
    if (registerScreen) {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        role,
      });
    } else {
      await login(form.email.trim(), form.password);
    }
  } catch (error) {
    Feedback.alert("Não foi possível entrar", error.message);
  }
}
```

No componente atual, a prop `register` é booleana. Renomeie essa prop para `registerScreen` ou renomeie a função do contexto para `registerAccount`, evitando conflito de nomes. Exponha a função escolhida no Provider.

Em `src/screens/Requests.js`, na confirmação da nova coleta, use:

```javascript
async function submit() {
  if (!validate()) return;
  try {
    const id = await addRequest({
      ...form,
      quantity: parseQuantity(form.quantity),
      address: form.address.trim(),
    });
    navigation.replace("RequestDetail", { id });
  } catch (error) {
    Feedback.alert("Não foi possível agendar", error.message);
  }
}
```

Em `PointForm` de `src/screens/Points.js`, aguarde `savePoint` antes de mostrar sucesso e de `navigation.goBack()`. Em `EditProfile`, aguarde `updateUser` antes de voltar. Todo botão que usa funções assíncronas (`aceitar`, `cancelar`, confirmar etapa, favoritos, disponibilidade, marcar lidas e sair) deve usar `try/catch` ou `.catch` e mostrar `Feedback.alert`.

Exemplo de handler simples:

```javascript
onPress={() => acceptRequest(request.id).catch(error =>
  Feedback.alert('Coleta', error.message)
)}
```

Durante o envio, use um estado `submitting` para desabilitar o botão e evitar toques repetidos. Não atualize a interface como se a gravação tivesse sucedido antes da resposta.

## 5. Remova a troca de papel e textos de simulação no modo conectado

O papel é escolhido no cadastro e retornado no login. A API não permite `updateUser({ role: 'driver' })`. Remova do perfil conectado os botões de troca livre de papel e o botão de restaurar mocks. Para testar, crie **três contas diferentes** e faça logout/login.

A lista inicial de pontos estará vazia até um perfil `point` cadastrar seu ponto. Remova o botão **Explorar demonstração** no modo conectado ou mantenha-o em um modo isolado que não use esta API. Atualize os textos de cadastro, senha e acompanhamento para não prometer login fictício. A recuperação de senha ainda não faz parte desta API; remova/identifique o botão correspondente.

O home de motorista precisa juntar `/requests` (atribuídas) e `/requests/available`; `loadAppData` já faz isso. Atualize as listas ao abrir as telas ou com um botão de atualização; este backend não usa WebSocket e não faz polling automaticamente.

Para o destino histórico, em `RequestDetail`, prefira `request.pointName` e `request.pointAddress` quando mostrar os dados associados à coleta. `pointId` continua permitindo abrir o cadastro atual do ponto.

## 6. Teste com contas reais do seu banco

1. Cadastre um perfil `point` e crie um ponto.
2. Faça logout e cadastre/entre com perfil `resident`; solicite uma coleta.
3. Faça logout e entre com perfil `driver`; aceite, retire e entregue.
4. Entre com o perfil `point` proprietário e confirme o recebimento.
5. Entre como `resident` para conferir o pedido concluído e as notificações.

Você pode usar celulares diferentes: os dados agora vêm do mesmo banco. Os tokens são individuais e cada perfil tem autorização própria.

## Tela quântica

O frontend atualizado contém `src/screens/Quantum.js` e `src/services/quantumApi.js`. Configure EXPO_PUBLIC_API_URL. O exemplo público funciona com a API e o serviço Python ligados; a comparação de pedidos reais requer AppContext conectado e token em SecureStore na chave `ecoconecta.session`. Veja QUANTUM.md para os dois endpoints e os limites do circuito.
