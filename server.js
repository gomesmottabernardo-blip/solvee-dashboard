import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ESM paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const DASHBOARD_URL = process.env.DASHBOARD_URL;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN;

console.log('✅ Servidor iniciando...');
console.log(`📊 Dashboard URL: ${DASHBOARD_URL}`);
console.log(`🔐 Supabase URL: ${SUPABASE_URL}`);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// AUTENTICAÇÃO - Verificar token JWT
// ========================================

async function verificarAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const token = authHeader.substring(7);

  try {
    // Verificar token com Supabase Auth API
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY,
      },
    });

    if (!response.ok) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = await response.json();

    // Verificar se está autorizado
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/authorized_users?email=eq.${encodeURIComponent(user.email)}`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const authorized = await checkResponse.json();

    if (!Array.isArray(authorized) || authorized.length === 0) {
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

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    // Login com Supabase Auth
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const data = await response.json();

    // Verificar se está autorizado
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/authorized_users?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const authorized = await checkResponse.json();

    if (!Array.isArray(authorized) || authorized.length === 0) {
      return res.status(403).json({ error: 'Usuário não autorizado' });
    }

    res.json({
      token: data.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logout realizado' });
});

// ========================================
// ROTAS DO DASHBOARD
// ========================================

app.get('/api/dashboard', verificarAuth, async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/dashboard_cache?select=html_content,fetched_at&order=fetched_at.desc&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'Dashboard não disponível' });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data[0].html_content);
  } catch (err) {
    console.error('Erro ao buscar dashboard:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/status', verificarAuth, async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/dashboard_cache?select=fetched_at,status&order=fetched_at.desc&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'Sem dados de sincronização' });
    }

    res.json({
      lastFetch: data[0].fetched_at,
      status: data[0].status,
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

    // Inserir no Supabase via API REST
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        html_content: htmlContent,
        status: 'success',
      }),
    });

    if (!insertResponse.ok) {
      const error = await insertResponse.json();
      throw new Error(`Erro ao armazenar: ${error.message}`);
    }

    console.log('[CRON] Dashboard sincronizado com sucesso às', new Date().toISOString());
  } catch (err) {
    console.error('[CRON] Erro na sincronização:', err.message);

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/dashboard_cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          html_content: '',
          status: 'failed',
        }),
      });
    } catch (erroFalha) {
      console.error('[CRON] Erro ao registrar falha:', erroFalha.message);
    }
  }
}

// ========================================
// AGENDADOR CRON
// ========================================

cron.schedule('0 8 * * *', sincronizarDashboard);

// Sincronizar em background após 3 segundos
setTimeout(() => {
  sincronizarDashboard();
}, 3000);

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
});
