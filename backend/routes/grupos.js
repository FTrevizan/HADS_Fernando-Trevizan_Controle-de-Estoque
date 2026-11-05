import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();

router.use(autenticar, exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO'));

router.get('/', async (req, res) => {
  const { busca } = req.query;
  const valores = [];
  let where = '';

  if (busca) {
    valores.push(`%${busca}%`);
    where = 'WHERE g.nome ILIKE $1';
  }

  try {
    const { rows } = await pool.query(
      `SELECT g.id_grupo, g.nome, g.descricao,
              COUNT(p.id_produto)::int AS total_produtos,
              COUNT(p.id_produto) FILTER (
                WHERE p.ativo AND p.estoque_atual < p.estoque_min
              )::int AS total_baixo
         FROM grupo_produto g
         LEFT JOIN produto p ON p.id_grupo = g.id_grupo
         ${where}
        GROUP BY g.id_grupo
        ORDER BY g.nome`,
      valores
    );
    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar grupos.' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

  try {
    const { rows } = await pool.query(
      'SELECT id_grupo, nome, descricao FROM grupo_produto WHERE id_grupo = $1',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    res.json(rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao consultar grupo.' });
  }
});

router.post('/', async (req, res) => {
  const { nome, descricao } = req.body || {};

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Informe o nome do grupo.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO grupo_produto (nome, descricao)
       VALUES ($1, $2)
       RETURNING id_grupo, nome, descricao`,
      [nome.trim(), descricao?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um grupo com este nome.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar grupo.' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

  const { nome, descricao } = req.body || {};
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Informe o nome do grupo.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE grupo_produto
          SET nome = $1, descricao = $2
        WHERE id_grupo = $3
        RETURNING id_grupo, nome, descricao`,
      [nome.trim(), descricao?.trim() || null, id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    res.json(rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um grupo com este nome.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao alterar grupo.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM grupo_produto WHERE id_grupo = $1',
      [id]
    );
    if (rowCount === 0) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    res.json({ ok: true });
  } catch (erro) {
    if (erro.code === '23503') {
      return res.status(409).json({ erro: 'Este grupo possui produtos e não pode ser excluído.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao excluir grupo.' });
  }
});

export default router;