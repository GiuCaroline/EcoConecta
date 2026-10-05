# Frontend conectado ao banco

O frontend atualizado substitui o AppContext demonstrativo por chamadas à API. Os contratos da API permanecem compatíveis; não há nova migração de banco para esta atualização.

## Configuração

1. Preserve `.env` do backend com DATABASE_URL, DIRECT_DATABASE_URL e as configurações do serviço quântico.
2. Dentro do frontend, instale as dependências com `npm ci` usando o package.json/package-lock atualizados.
3. Configure `ecoConecta/.env` com EXPO_PUBLIC_API_URL=http://IP_DO_COMPUTADOR:3000 e reinicie o Expo com `npx expo start --clear`.
4. Inicie a API com `npm run dev` no backend. No telefone, abra http://IP_DO_COMPUTADOR:3000/health para confirmar a rede.

Não coloque credenciais do banco ou QUANTUM_API_KEY no frontend. Em produção use a URL HTTPS da API hospedada. O túnel do Expo não expõe a porta do backend.

## O que já está conectado

Cadastro e login, verificação e revogação de sessão, edição de perfil, pontos e edição do proprietário, favoritos, criação/cancelamento/aceite/retirada/entrega/recebimento de coletas e notificações. As telas esperam as respostas, desabilitam envios repetidos e mostram erros. A comparação quântica de coletas usa o endpoint protegido e lê os pesos do banco.

O perfil é definido no cadastro e é retornado no login. Não existe troca livre de perfil na sessão nem restauração de dados de exemplo. Uma conta não herda os dados privados de outra. Contas criadas na versão antiga local não foram gravadas no banco e precisam ser cadastradas novamente.

No Android/iOS, o token é salvo por expo-secure-store na chave ecoconecta.session. No navegador ele fica somente em memória; recarregar exige login novamente. O estado de pontos/pedidos não é persistido localmente nem inicializado com mocks.

Os dados são atualizados ao abrir telas, ao voltar ao app, por ação Atualizar dados/puxar para atualizar e por consulta a cada 20 segundos enquanto ativo. Não há WebSocket ou push.

## Testar no Neon

Cadastre três contas com e-mails distintos: responsável por ponto, morador e motorista. Cadastre o ponto com a primeira, solicite com a segunda e aceite/retire/entregue com a terceira. Entre novamente com o responsável para confirmar recebimento. Use Perfil → Sair da conta para trocar de conta.

No SQL Editor:

```sql
SELECT id, name, email, role FROM users ORDER BY created_at DESC;
SELECT id, resident_id, driver_id, point_id, status, cancelled FROM requests ORDER BY created_at DESC;
```

Veja também o README do frontend para o passo a passo de instalação, revisão do teclado e testes automatizados. O serviço em mobile-example/api.js é uma referência antiga; o aplicativo atualizado já contém seu próprio cliente completo em src/services/apiClient.js e src/services/api.js.
