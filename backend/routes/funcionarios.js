import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
const PERFIS = ['ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS'];

router.use(autenticar, exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO'));

router.get('/', async (req, res) => {
    const { busca, ativo } = req.query;
    const condicoes = [];
    const valores = [];

    if (busca) {
        valores.push(`%${busca}%`);
        condicoes.push(`(nome ILIKE $${valores.length} OR matricula ILIKE $${valores.length})`);
    }
    if (ativo === 'true' || ativo === 'false') {
        valores.push(ativo === 'true');
        condicoes.push(`ativo = $${valores.length}`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    try {
        const { rows } = await pool.query(
            `SELECT id_funcionario, matricula, nome, setor, ativo, login, perfil
         FROM funcionario
         ${where}
        ORDER BY nome`,
            valores
        );
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar funcionários.' });
    }
});

router.post('/', async (req, res) => {
    const { matricula, nome, setor, login, senha, perfil } = req.body || {};

    if (!matricula || !nome || !setor) {
        return res.status(400).json({ erro: 'Informe matrícula, nome e setor.' });
    }

    const temAcesso = !!(login || senha || perfil);

    if (temAcesso) {
        if (req.usuario.perfil !== 'ADMINISTRADOR') {
            return res.status(403).json({ erro: 'Só o administrador pode definir login e perfil.' });
        }
        if (!login || !senha || !perfil) {
            return res.status(400).json({ erro: 'Para dar acesso, informe login, senha e perfil.' });
        }
        if (!PERFIS.includes(perfil)) {
            return res.status(400).json({ erro: 'Perfil inválido.' });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
        }
    }

    try {
        const senhaHash = temAcesso ? await bcrypt.hash(senha, 10) : null;

        const { rows } = await pool.query(
            `INSERT INTO funcionario (matricula, nome, setor, login, senha_hash, perfil)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_funcionario, matricula, nome, setor, ativo, login, perfil`,
            [
                matricula.trim(),
                nome.trim(),
                setor.trim(),
                temAcesso ? login.trim() : null,
                senhaHash,
                temAcesso ? perfil : null,
            ]
        );
        res.status(201).json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            const campo = erro.constraint?.includes('login') ? 'login' : 'matrícula';
            return res.status(409).json({ erro: `Já existe um funcionário com este ${campo}.` });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao cadastrar funcionário.' });
    }
});

router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    try {
        const { rows } = await pool.query(
            `SELECT id_funcionario, matricula, nome, setor, ativo, login, perfil
         FROM funcionario
        WHERE id_funcionario = $1`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
        res.json(rows[0]);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao consultar funcionário.' });
    }
});


router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    const { matricula, nome, setor, login, senha, perfil } = req.body || {};

    if (!matricula || !nome || !setor) {
        return res.status(400).json({ erro: 'Informe matrícula, nome e setor.' });
    }

    try {
        const atual = (await pool.query(
            'SELECT login, senha_hash, perfil FROM funcionario WHERE id_funcionario = $1',
            [id]
        )).rows[0];

        if (!atual) return res.status(404).json({ erro: 'Funcionário não encontrado.' });

        let loginFinal = atual.login;
        let hashFinal = atual.senha_hash;
        let perfilFinal = atual.perfil;

        if (login || senha || perfil) {
            if (req.usuario.perfil !== 'ADMINISTRADOR') {
                return res.status(403).json({ erro: 'Só o administrador pode alterar login, senha e perfil.' });
            }
            if (perfil && !PERFIS.includes(perfil)) {
                return res.status(400).json({ erro: 'Perfil inválido.' });
            }
            if (senha && senha.length < 6) {
                return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
            }

            loginFinal = login ? login.trim() : atual.login;
            perfilFinal = perfil || atual.perfil;
            hashFinal = senha ? await bcrypt.hash(senha, 10) : atual.senha_hash;

            if (!loginFinal || !hashFinal || !perfilFinal) {
                return res.status(400).json({ erro: 'Para dar acesso, informe login, senha e perfil.' });
            }
        }

        const { rows } = await pool.query(
            `UPDATE funcionario
          SET matricula = $1, nome = $2, setor = $3,
              login = $4, senha_hash = $5, perfil = $6
        WHERE id_funcionario = $7
        RETURNING id_funcionario, matricula, nome, setor, ativo, login, perfil`,
            [matricula.trim(), nome.trim(), setor.trim(), loginFinal, hashFinal, perfilFinal, id]
        );
        res.json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            const campo = erro.constraint?.includes('login') ? 'login' : 'matrícula';
            return res.status(409).json({ erro: `Já existe um funcionário com este ${campo}.` });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao alterar funcionário.' });
    }
});


router.patch('/:id/ativo', async (req, res) => {
    const id = Number(req.params.id);
    const { ativo } = req.body || {};

    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });
    if (typeof ativo !== 'boolean') {
        return res.status(400).json({ erro: 'Informe ativo como true ou false.' });
    }
    if (id === req.usuario.id && ativo === false) {
        return res.status(400).json({ erro: 'Você não pode desativar o seu próprio usuário.' });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE funcionario SET ativo = $1
        WHERE id_funcionario = $2
        RETURNING id_funcionario, matricula, nome, setor, ativo`,
            [ativo, id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
        res.json(rows[0]);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao alterar situação do funcionário.' });
    }
});

export default router;