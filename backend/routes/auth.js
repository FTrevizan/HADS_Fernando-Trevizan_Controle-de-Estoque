import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();


router.post('/login', async (req, res) => {
  const { login, senha } = req.body || {};

  if (!login || !senha) {
    return res.status(400).json({ erro: 'Informe login e senha.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id_funcionario, nome, setor, perfil, senha_hash, ativo
         FROM funcionario
        WHERE login = $1`,
      [login]
    );
    const func = rows[0];

    const senhaOk = func && func.senha_hash &&
      (await bcrypt.compare(senha, func.senha_hash));

    if (!senhaOk) {
      return res.status(401).json({ erro: 'Login ou senha inválidos.' });
    }
    if (!func.ativo) {
      return res.status(403).json({ erro: 'Usuário desativado.' });
    }

    const usuario = {
      id: func.id_funcionario,
      nome: func.nome,
      setor: func.setor,
      perfil: func.perfil,
    };

    const token = jwt.sign(usuario, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES || '8h',
    });

    res.json({ token, usuario });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro interno ao fazer login.' });
  }
});

router.get('/me', autenticar, (req, res) => {
  const { id, nome, setor, perfil } = req.usuario;
  res.json({ id, nome, setor, perfil });
});

export default router;