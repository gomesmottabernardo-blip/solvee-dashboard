import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Token do servidor de dashboard (CRÍTICO: nunca no front-end)
const DASHBOARD_URL = process.env.DASHBOARD_URL;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN;

// ESM paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// AUTENTICAÇÃO
// ========================================

// Verificar token JWT e usuário autorizado
async function verificarAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const token = authHeader.substring(7);

  try {
    // Verificar token com Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se usuário está na lista de autorizados
    const { data: autorizado, error: erroCheck } = await supabase
      .from('authorized_users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (erroCheck || !autorizado) {
      return res.status(403).json({ error: 'Usuário não autorizado' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Erro na autenticação:', err);
    res.status(401).json({ error: 'Falha na autenticação' });
  }
}

// ========================================
// ROTAS DE AUTENTICAÇÃO
// ========================================

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Verificar se usuário está autorizado
    const { data: autorizado, error: erroCheck } = await supabase
      .from('authorized_users')
      .select('id')
      .eq('email', email)
      .single();

    if (erroCheck || !autorizado) {
      return res.status(403).json({ error: 'Usuário não autorizado' });
    }

    res.json({
      token: data.session.access_token,
      user: data.user,
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ message: 'Logout realizado' });
  } catch (err) {
    console.error('Erro no logout:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ========================================
// ROTAS DO DASHBOARD
// ========================================

// Buscar HTML em cache
app.get('/api/dashboard', verificarAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dashboard_cache')
      .select('html_content, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Dashboard não disponível' });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data.html_content);
  } catch (err) {
    console.error('Erro ao buscar dashboard:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Verificar status da última sincronização
app.get('/api/status', verificarAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dashboard_cache')
      .select('fetched_at, status')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Sem dados de sincronização' });
    }

    res.json({
      lastFetch: data.fetched_at,
      status: data.status,
    });
  } catch (err) {
    console.error('Erro ao buscar status:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ========================================
// FUNÇÃO DE SINCRONIZAÇÃO
// ========================================

async function sincronizarDashboard() {
  console.log('[CRON] Iniciando sincronização do dashboard...');

  try {
    const urlComToken = `${DASHBOARD_URL}?k=${DASHBOARD_TOKEN}`;

    const response = await fetch(urlComToken, {
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const htmlContent = await response.text();

    // Armazenar no Supabase
    const { error: erroInsert } = await supabase
      .from('dashboard_cache')
      .insert({
        html_content: htmlContent,
        status: 'success',
      });

    if (erroInsert) {
      console.error('[CRON] Erro ao inserir:', erroInsert.message);
      throw new Error(`Erro ao armazenar: ${erroInsert.message}`);
    }

    console.log('[CRON] Dashboard sincronizado com sucesso às', new Date().toISOString());
  } catch (err) {
    console.error('[CRON] Erro na sincronização:', err.message);

    try {
      // Registrar falha (melhor esforço)
      await supabase
        .from('dashboard_cache')
        .insert({
          html_content: '',
          status: 'failed',
        });
    } catch (erroFalha) {
      console.error('[CRON] Erro ao registrar falha:', erroFalha.message);
    }
  }
}

// ========================================
// AGENDADOR CRON
// ========================================

// Sincronizar diariamente às 8:00 AM
// Formato: "minuto hora dia mês dia-da-semana"
cron.schedule('0 8 * * *', sincronizarDashboard);

// Sincronizar uma vez ao iniciar (para popular o banco inicial)
console.log('[INIT] Sincronizando dashboard na inicialização...');
sincronizarDashboard();

// ========================================
// HEALTH CHECK
// ========================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Dashboard URL: ${DASHBOARD_URL}`);
  console.log(`🔐 Supabase URL: ${supabaseUrl}`);
});