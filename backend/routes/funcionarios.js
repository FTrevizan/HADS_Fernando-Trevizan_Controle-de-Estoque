import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
const PERFIS = ['ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS'];

router.use(autenticar, exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO'));

const COLUNAS = `id_funcionario, matricula, matricula_rh, nome, setor, ativo, login, perfil`;

// Mensagem de duplicidade conforme a coluna que violou o UNIQUE
function campoDuplicado(erro) {
    const c = erro.constraint || '';
    if (c.includes('matricula_rh')) return 'matrícula do RH';
    if (c.includes('login')) return 'login';
    return 'matrícula';
}

// GET /api/funcionarios?busca=maria&ativo=true
router.get('/', async (req, res) => {
    const { busca, ativo } = req.query;
    const condicoes = [];
    const valores = [];

    if (busca) {
        valores.push(`%${busca}%`);
        const n = valores.length;
        condicoes.push(`(nome ILIKE $${n} OR matricula ILIKE $${n} OR matricula_rh ILIKE $${n})`);
    }
    if (ativo === 'true' || ativo === 'false') {
        valores.push(ativo === 'true');
        condicoes.push(`ativo = $${valores.length}`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    try {
        const { rows } = await pool.query(
            `SELECT ${COLUNAS} FROM funcionario ${where} ORDER BY nome`,
            valores
        );
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar funcionários.' });
    }
});

// POST /api/funcionarios
// Matrícula de controle: sempre gerada pelo banco.
// Matrícula do RH: gerada pelo banco, a menos que seja informada
router.post('/', async (req, res) => {
    const { nome, setor, matricula_rh, login, senha, perfil } = req.body || {};

    if (!nome || !setor) {
        return res.status(400).json({ erro: 'Informe nome e setor.' });
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

        // COALESCE só chama o nextval quando o RH não foi informado
        const { rows } = await pool.query(
            `INSERT INTO funcionario (nome, setor, matricula_rh, login, senha_hash, perfil)
       VALUES ($1, $2, COALESCE($3::varchar, nextval('seq_matricula_rh')::text), $4, $5, $6)
       RETURNING ${COLUNAS}`,
            [
                nome.trim(),
                setor.trim(),
                (matricula_rh || '').trim() || null,
                temAcesso ? login.trim() : null,
                senhaHash,
                temAcesso ? perfil : null,
            ]
        );
        res.status(201).json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            return res.status(409).json({ erro: `Já existe um funcionário com este ${campoDuplicado(erro)}.` });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao cadastrar funcionário.' });
    }
});

// GET /api/funcionarios/:id
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    try {
        const { rows } = await pool.query(
            `SELECT ${COLUNAS} FROM funcionario WHERE id_funcionario = $1`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
        res.json(rows[0]);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao consultar funcionário.' });
    }
});

// PUT /api/funcionarios/:id
// A matrícula de controle nunca muda. A do RH só muda se for informada
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    const { nome, setor, matricula_rh, login, senha, perfil } = req.body || {};

    if (!nome || !setor) {
        return res.status(400).json({ erro: 'Informe nome e setor.' });
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
          SET nome = $1, setor = $2, matricula_rh = COALESCE($3::varchar, matricula_rh),
              login = $4, senha_hash = $5, perfil = $6
        WHERE id_funcionario = $7
        RETURNING ${COLUNAS}`,
            [nome.trim(), setor.trim(), (matricula_rh || '').trim() || null,
                loginFinal, hashFinal, perfilFinal, id]
        );
        res.json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            return res.status(409).json({ erro: `Já existe um funcionário com este ${campoDuplicado(erro)}.` });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao alterar funcionário.' });
    }
});

// PATCH /api/funcionarios/:id/ativo   { ativo: true|false }
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
        RETURNING id_funcionario, matricula, matricula_rh, nome, setor, ativo`,
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