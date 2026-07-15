<div align="center">

# Que KM é Esse? — API

Backend REST para o app de controle financeiro de motoristas autônomos.

[Frontend](https://github.com/MarceloMendes021/que-km-web) · [API em Produção](https://que-km-api.onrender.com) · [Reportar Bug](https://github.com/MarceloMendes021/que-km-api/issues)

![Deploy](https://img.shields.io/badge/deploy-render-46E3B7?style=flat-square&logo=render)
![TypeScript](https://img.shields.io/badge/typescript-6.0-007ACC?style=flat-square&logo=typescript)
![Node.js](https://img.shields.io/badge/node-22-339933?style=flat-square&logo=node.js)

</div>

---

## O que é isso

API REST que alimenta o [Que KM é Esse?](https://que-km-web.vercel.app) — um PWA para motoristas de app acompanharem quanto ganharam por quilômetro rodado em cada jornada.

Recebe os dados de jornadas, despesas e configurações do usuário, calcula os insights financeiros e retorna os resultados para o frontend.

---

## Stack

| Tecnologia  | Versão | Uso                         |
| ----------- | ------ | --------------------------- |
| Node.js     | 22     | Runtime                     |
| Express     | 5      | Framework HTTP              |
| TypeScript  | 6      | Tipagem                     |
| PostgreSQL  | —      | Banco de dados              |
| pg          | 8      | Driver do PostgreSQL        |
| Clerk       | 4      | Verificação de JWT          |
| Zod         | 4      | Validação de requisições    |
| Svix        | 1      | Verificação de webhooks     |
| ts-node-dev | 2      | Servidor de desenvolvimento |

---

## Estrutura de Pastas

```
src/
├── db/
│   ├── client.ts              # Pool de conexão com o PostgreSQL
│   └── migrations/
│       └── 001_create_tables.sql   # Schema inicial do banco
├── middleware/
│   ├── auth.ts                # Verifica o JWT do Clerk em rotas protegidas
│   └── errorHandler.ts        # Tratamento centralizado de erros
├── routes/
│   ├── expenses.ts            # CRUD de despesas
│   ├── insights.ts            # Cálculo de métricas mensais
│   ├── journeyConfig.ts       # Configuração de veículo e metas
│   ├── profile.ts             # Perfil do usuário
│   ├── webhooks.ts            # Webhook do Clerk para criar usuário no banco
│   └── workdays.ts            # Registro de jornadas
├── services/
│   └── userService.ts         # Busca e atualiza dados do usuário
├── types/                     # Tipos TypeScript compartilhados
├── app.ts                     # Configuração do Express e rotas
└── server.ts                  # Inicialização do servidor
```

---

## Banco de Dados

```sql
users
  id, clerk_id, display_name, email, phone, avatar_url, created_at, updated_at

journey_configs
  id, user_id*, car_model, fuel_type, avg_consumption,
  month_goal, planned_days, min_value_per_km, updated_at

workdays
  id, user_id*, date, start_odometer, end_odometer,
  earnings_uber, earnings_99, earnings_particular, status, created_at, updated_at

expenses
  id, user_id*, workday_id*, category, amount, description,
  date, payment_method, created_at
```

`*` chave estrangeira com `ON DELETE CASCADE`

---

## Rotas

Todas as rotas abaixo de `/api/` (exceto `/api/webhooks`) exigem o header:

```
Authorization: Bearer <clerk_jwt_token>
```

| Método | Rota                       | Descrição                                            |
| ------ | -------------------------- | ---------------------------------------------------- |
| POST   | `/api/webhooks/clerk`      | Cria o usuário no banco após cadastro no Clerk       |
| GET    | `/api/profile`             | Retorna o perfil do usuário autenticado              |
| PUT    | `/api/profile`             | Atualiza nome e foto do perfil                       |
| GET    | `/api/journey-config`      | Retorna a configuração de veículo e metas            |
| PUT    | `/api/journey-config`      | Salva ou atualiza a configuração                     |
| POST   | `/api/workdays`            | Inicia uma nova jornada com hodômetro inicial        |
| GET    | `/api/workdays/active`     | Retorna a jornada ativa do usuário, se houver        |
| GET    | `/api/workdays`            | Lista jornadas finalizadas do mês (`?month=YYYY-MM`) |
| PATCH  | `/api/workdays/:id/finish` | Encerra a jornada com ganhos e despesas              |
| DELETE | `/api/workdays/:id`        | Remove uma jornada e suas despesas                   |
| GET    | `/api/expenses`            | Lista despesas do mês (`?month=YYYY-MM`)             |
| POST   | `/api/expenses`            | Adiciona uma despesa                                 |
| PUT    | `/api/expenses/:id`        | Atualiza uma despesa                                 |
| DELETE | `/api/expenses/:id`        | Remove uma despesa                                   |
| GET    | `/api/insights`            | Retorna métricas financeiras do mês atual            |

---

## Pré-requisitos

- [Node.js](https://nodejs.org) v18 ou superior
- PostgreSQL rodando localmente ou acessível via URL
- Uma conta no [Clerk](https://clerk.com) com um aplicativo criado

---

## Configuração

**1. Clone o repositório**

```bash
git clone https://github.com/MarceloMendes021/que-km-api.git
cd que-km-api
```

**2. Instale as dependências**

```bash
npm install
```

**3. Configure as variáveis de ambiente**

```bash
cp .env.example .env
```

Preencha o `.env`:

```env
# String de conexão do PostgreSQL
DATABASE_URL=postgresql://usuario:senha@localhost:5432/que_km

# Chave secreta do Clerk — dashboard.clerk.com > API Keys > Secret key
CLERK_SECRET_KEY=sk_live_...

# Segredo do webhook do Clerk — dashboard.clerk.com > Webhooks > Signing secret
CLERK_WEBHOOK_SECRET=whsec_...

# URL do issuer do Clerk — dashboard.clerk.com > API Keys > JWT issuer
CLERK_ISSUER_URL=https://seu-app.clerk.accounts.dev

# Porta local do servidor
PORT=3000

# Ambiente (development | production)
NODE_ENV=development

# Origens permitidas para o CORS
ALLOWED_ORIGINS=http://localhost:5173
```

---

## Rodando localmente

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000`.

**Outros comandos:**

```bash
npm run build    # Compila o TypeScript para dist/
npm start        # Roda a versão compilada (produção)
```

---

## Deploy

O deploy é automático via [Render](https://render.com). Qualquer push na branch `main` dispara um novo build e deploy sem intervenção manual.

O build command configurado no Render é:

```bash
npm install --include=dev && npm run build
```

O `--include=dev` é necessário porque o TypeScript e os `@types/*` estão em `devDependencies` mas são usados na compilação.

---

## Como funciona a autenticação

O middleware `auth.ts` intercepta todas as requisições protegidas e verifica o JWT emitido pelo Clerk:

```
Requisição chega com Authorization: Bearer <token>
          |
auth.ts extrai o token do header
          |
verifyToken() valida a assinatura com CLERK_SECRET_KEY
          |
Se válido, busca o user_id interno no banco pelo clerk_id
          |
Injeta req.userId e passa para a rota
          |
Se inválido, retorna 401
```

Quando um usuário se cadastra pelo Clerk (e-mail ou login social), o Clerk dispara um webhook para `/api/webhooks/clerk`. Esse endpoint verifica a assinatura com Svix e cria o registro do usuário no banco — garantindo que o `clerk_id` existe antes de qualquer outra operação.

---

## Decisões técnicas

**SQL direto com `pg`**
Sem ORM. Todas as queries são escritas em SQL usando o driver `pg`. Mais controle sobre o que vai para o banco, sem camada de abstração entre o código e as queries.

**Validação com Zod no entry point**
Cada rota valida o `req.body` com Zod antes de qualquer lógica. Se a validação falha, o erro é lançado e o `errorHandler` retorna 400 sem precisar de `try/catch` em cada rota.

**Pool de conexão com tratamento de queda**
O `client.ts` usa `Pool` do `pg` com `db.on("error")` para capturar desconexões sem derrubar o servidor. Resolve o problema de cold start do PostgreSQL no Render, que encerra conexões ociosas após alguns minutos.

**Erros centralizados**
`errorHandler.ts` define classes de erro (`UnauthorizedError`, `NotFoundError`, `BadRequestError`) que carregam o status HTTP. O Express os intercepta e retorna a resposta correta sem duplicar lógica nas rotas.

---

## Autor

Feito por **Marcelo Mendes**

[![GitHub](https://img.shields.io/badge/GitHub-MarceloMendes021-181717?style=flat-square&logo=github)](https://github.com/MarceloMendes021)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-marcelo021-0077B5?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/marcelo021)
