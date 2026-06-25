# 🎯 Solvee Dashboard App

Dashboard seguro com autenticação para colaboradores da Solvee.

**Funcionalidades:**
- ✅ Autenticação via email + senha (Supabase)
- ✅ Sincronização automática diária do dashboard
- ✅ Cache local com fallback se busca falhar
- ✅ Token de acesso seguro (nunca exposto ao navegador)
- ✅ Suporte a 5+ usuários autorizados
- ✅ Interface responsiva

---

## 🚀 Setup Rápido (24h)

### **Passo 1: Preparar Supabase (5 min)**

1. Acesse sua conta Supabase: https://supabase.com
2. Vá para o SQL Editor do seu projeto
3. Execute o conteúdo do arquivo `supabase_setup.sql`
4. Verifique se as tabelas foram criadas (Menu lateral → SQL Editor → Query Histórico)

**Resultado esperado:**
- Tabela `dashboard_cache` criada
- Tabela `authorized_users` criada
- Seu e-mail (gomesmotta.bernardo@gmail.com) adicionado como usuário autorizado

---

### **Passo 2: Setup Local (5 min)**

```bash
# 1. Clonar / copiar os arquivos
cd ~/seu-projeto/solvee-dashboard

# 2. Instalar dependências
npm install

# 3. Criar arquivo .env baseado em .env.example
cp .env.example .env

# 4. Editar .env com suas variáveis:
nano .env
```

**Conteúdo do `.env`:**
```
PORT=3000
SUPABASE_URL=https://nkfqbhciyfwuswhfqwfu.supabase.co
SUPABASE_KEY=sb_publishable_Dy9nLHqVnKfMngU4yf85fw_35UTYzYf
DASHBOARD_URL=http://109.123.246.232:9000/latest.html
DASHBOARD_TOKEN=dwMM4ZYC1HJ-gdc7GJhbwlejBEjgkJ1fz2sERaP9O3w
NODE_ENV=production
```

---

### **Passo 3: Testar Localmente**

```bash
npm start
```

Acesse: http://localhost:3000

Tente fazer login com seu e-mail. Se tiver erro, é porque o usuário não existe em Supabase Auth. Continue para criar usuários abaixo.

---

### **Passo 4: Criar Usuários no Supabase**

Você precisa criar os usuários manualmente no Supabase antes que eles possam fazer login.

1. Acesse seu projeto Supabase → Menu "Authentication"
2. Clique em "+ New user" e preencha:
   - **Email:** seu@email.com
   - **Password:** senha-temporaria-123
   - Clique "Create User"

3. Repita para todos os 5 colaboradores

**Importante:** Comunique a senha temporária com segurança. Os usuários podem mudar depois.

Alternativamente, você pode criar um script para isso (fale comigo depois).

---

### **Passo 5: Deploy em Render.com**

#### **5a. Preparar repositório Git**

```bash
# Inicializar git (se não tiver)
git init
git add .
git commit -m "Initial commit: Solvee Dashboard"

# Fazer upload para GitHub / GitLab / Render Repos
git push origin main
```

Opção recomendada: subir para **GitHub** (público ou privado).

---

#### **5b. Conectar no Render**

1. Acesse https://render.com
2. Crie conta (grátis)
3. Clique em "+ New" → "Web Service"
4. Conecte seu repositório Git
5. Preencha:
   - **Name:** `solvee-dashboard`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node.js
   - **Region:** São Paulo (ou mais perto de você)
   - **Plan:** Free (gratuito)

---

#### **5c. Adicionar Variáveis de Ambiente**

No Render, vá em "Environment" e adicione:

```
PORT=3000
SUPABASE_URL=https://nkfqbhciyfwuswhfqwfu.supabase.co
SUPABASE_KEY=sb_publishable_Dy9nLHqVnKfMngU4yf85fw_35UTYzYf
DASHBOARD_URL=http://109.123.246.232:9000/latest.html
DASHBOARD_TOKEN=dwMM4ZYC1HJ-gdc7GJhbwlejBEjgkJ1fz2sERaP9O3w
NODE_ENV=production
```

**CRÍTICO:** Certifique-se de que `DASHBOARD_TOKEN` está bem configurado.

---

#### **5d. Deploy**

Clique em "Create Web Service". O Render vai:
1. Clonar seu repositório
2. Instalar dependências
3. Rodar o servidor
4. Gerar uma URL pública (ex: `https://solvee-dashboard-xyz.onrender.com`)

**Espere 3-5 minutos** até a implantação ficar pronta.

---

## 🔐 Segurança

- ✅ **Token do servidor nunca exposto:** fica em `.env` no backend
- ✅ **Autenticação via JWT:** Supabase gera tokens seguros
- ✅ **RLS (Row Level Security) habilitado:** apenas usuários autenticados acessam dados
- ✅ **HTTPS automático:** Render fornece SSL/TLS
- ✅ **Cache com fallback:** se houver falha, mantém versão anterior

---

## 🔄 Como Funciona

```
1. Colaborador entra em https://solvee-dashboard-xyz.onrender.com
   ↓
2. Faz login com e-mail + senha
   ↓
3. Backend verifica credenciais no Supabase Auth
   ↓
4. Backend verifica se e-mail está em authorized_users
   ↓
5. Se OK, retorna JWT token
   ↓
6. Frontend armazena token no localStorage
   ↓
7. Frontend faz requisição GET /api/dashboard com token
   ↓
8. Backend busca HTML em cache do dashboard_cache
   ↓
9. Backend retorna HTML (nunca expõe o token do servidor)
   ↓
10. Frontend exibe no navegador
```

**Agendamento automático:**
- Todos os dias às 8h (UTC), o backend busca novo HTML de http://109.123.246.232:9000 usando o token seguro
- Armazena em `dashboard_cache`
- Se a busca falhar, mantém a versão anterior

---

## 📋 Checklist Final

- [ ] SQL do Supabase executado
- [ ] Arquivo `.env` configurado
- [ ] Node.js instalado (`node --version`)
- [ ] Teste local (`npm start`)
- [ ] Usuários criados no Supabase Auth (5 colaboradores + você)
- [ ] Repositório Git criado e pronto
- [ ] Deploy feito no Render
- [ ] Teste acesso à URL pública (faça login)
- [ ] Comunique URL + credenciais para os 4 outros colaboradores

---

## 🆘 Troubleshooting

### "Token inválido" ao fazer login
- Verifique se o usuário foi criado em Supabase → Authentication
- Verifique se o e-mail está correto (case-sensitive)

### "Usuário não autorizado"
- Verifique se o e-mail foi adicionado em `authorized_users` (SQL de setup)

### Dashboard não carrega
- Verifique se seu servidor (109.123.246.232:9000) está acessível
- Verifique o token `DASHBOARD_TOKEN` no `.env`
- Veja os logs do Render: https://dashboard.render.com → seu serviço → "Logs"

### "Erro de CORS"
- Verifique se `SUPABASE_URL` e `SUPABASE_KEY` estão corretos

---

## 📞 Contato

Se algo não funcionar, me avise com:
1. **URL do Render** (a que você está acessando)
2. **Mensagem de erro exata** (do navegador ou logs)
3. **O que você fez antes do erro** (qual ação clicou?)

---

**Pronto em 24h!** 🚀
