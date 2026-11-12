import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import funcionariosRoutes from './routes/funcionarios.js';
import gruposRoutes from './routes/grupos.js';
import produtosRoutes from './routes/produtos.js';
import movimentacoesRoutes from './routes/movimentacoes.js';
import solicitacoesRoutes from './routes/solicitacoes.js';
import episRoutes from './routes/epis.js';
import relatoriosRoutes from './routes/relatorios.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/grupos', gruposRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/movimentacoes', movimentacoesRoutes);
app.use('/api/solicitacoes', solicitacoesRoutes);
app.use('/api/epis', episRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/saude', (req, res) => {
  res.json({ ok: true, mensagem: 'API funcionando!' });
});

app.get('/api/banco', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT current_database() AS banco, COUNT(*) AS total FROM funcionario'
    );
    res.json({
      ok: true,
      banco: resultado.rows[0].banco,
      funcionarios: Number(resultado.rows[0].total)
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => {
  console.log(`API rodando em http://localhost:${porta}`);
});