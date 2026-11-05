import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
const verEstoque = exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS');
const gerenciar = exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO');

router.use(autenticar);

function lerProduto(body) {
    const b = body || {};
    const p = {
        id_grupo: Number(b.id_grupo),
        codigo: (b.codigo || '').trim(),
        nome: (b.nome || '').trim(),
        descricao: (b.descricao || '').trim() || null,
        tipo: b.tipo,
        unidade_medida: (b.unidade_medida || '').trim(),
        estoque_min: Number(b.estoque_min ?? 0),
        tamanho: null,
        validade: null,
    };

    if (p.tipo === 'EPI') {
        p.tamanho = (b.tamanho || '').trim() || null;
        p.validade = b.validade || null;
    }

    let erro = null;
    if (!p.codigo || !p.nome || !p.unidade_medida) erro = 'Informe código, nome e unidade de medida.';
    else if (!Number.isInteger(p.id_grupo)) erro = 'Selecione o grupo.';
    else if (!['MATERIAL', 'EPI'].includes(p.tipo)) erro = 'Tipo inválido.';
    else if (!Number.isInteger(p.estoque_min) || p.estoque_min < 0) erro = 'Estoque mínimo inválido.';

    return { p, erro };
}

function erroBanco(erro, res, mensagemPadrao) {
    if (erro.code === '23505') return res.status(409).json({ erro: 'Já existe um produto com este código.' });
    if (erro.code === '23503') return res.status(400).json({ erro: 'Grupo inválido.' });
    console.error(erro);
    return res.status(500).json({ erro: mensagemPadrao });
}

router.get('/', verEstoque, async (req, res) => {
    const { busca, grupo, tipo, ativo, baixo } = req.query;
    const cond = [];
    const val = [];

    if (busca) {
        val.push(`%${busca}%`);
        cond.push(`(p.nome ILIKE $${val.length} OR p.codigo ILIKE $${val.length})`);
    }
    if (grupo) {
        val.push(Number(grupo));
        cond.push(`p.id_grupo = $${val.length}`);
    }
    if (tipo === 'MATERIAL' || tipo === 'EPI') {
        val.push(tipo);
        cond.push(`p.tipo = $${val.length}`);
    }
    if (ativo === 'true' || ativo === 'false') {
        val.push(ativo === 'true');
        cond.push(`p.ativo = $${val.length}`);
    }
    if (baixo === 'true') cond.push('p.estoque_atual < p.estoque_min');

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    try {
        const { rows } = await pool.query(
            `SELECT p.id_produto, p.codigo, p.nome, p.tipo, p.unidade_medida,
              p.tamanho, p.validade, p.estoque_atual, p.estoque_min, p.ativo,
              g.id_grupo, g.nome AS grupo,
              (p.estoque_atual < p.estoque_min) AS estoque_baixo
         FROM produto p
         JOIN grupo_produto g ON g.id_grupo = p.id_grupo
         ${where}
        ORDER BY p.nome, p.tamanho`,
            val
        );
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar produtos.' });
    }
});

router.get('/:id', verEstoque, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    try {
        const { rows } = await pool.query(
            `SELECT id_produto, id_grupo, codigo, nome, descricao, tipo, unidade_medida,
              estoque_atual, estoque_min, tamanho, validade, ativo
         FROM produto WHERE id_produto = $1`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json(rows[0]);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao consultar produto.' });
    }
});

router.post('/', gerenciar, async (req, res) => {
    const { p, erro } = lerProduto(req.body);
    if (erro) return res.status(400).json({ erro });

    try {
        const { rows } = await pool.query(
            `INSERT INTO produto
         (id_grupo, codigo, nome, descricao, tipo, unidade_medida, estoque_min, tamanho, validade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id_produto, codigo, nome, tipo, estoque_atual, estoque_min, ativo`,
            [p.id_grupo, p.codigo, p.nome, p.descricao, p.tipo, p.unidade_medida,
            p.estoque_min, p.tamanho, p.validade]
        );
        res.status(201).json(rows[0]);
    } catch (e) {
        erroBanco(e, res, 'Erro ao cadastrar produto.');
    }
});

router.put('/:id', gerenciar, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    const { p, erro } = lerProduto(req.body);
    if (erro) return res.status(400).json({ erro });

    try {
        const { rows } = await pool.query(
            `UPDATE produto
          SET id_grupo = $1, codigo = $2, nome = $3, descricao = $4, tipo = $5,
              unidade_medida = $6, estoque_min = $7, tamanho = $8, validade = $9
        WHERE id_produto = $10
        RETURNING id_produto, codigo, nome, tipo, estoque_atual, estoque_min, ativo`,
            [p.id_grupo, p.codigo, p.nome, p.descricao, p.tipo, p.unidade_medida,
            p.estoque_min, p.tamanho, p.validade, id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json(rows[0]);
    } catch (e) {
        erroBanco(e, res, 'Erro ao alterar produto.');
    }
});

router.patch('/:id/ativo', gerenciar, async (req, res) => {
    const id = Number(req.params.id);
    const { ativo } = req.body || {};

    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });
    if (typeof ativo !== 'boolean') {
        return res.status(400).json({ erro: 'Informe ativo como true ou false.' });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE produto SET ativo = $1 WHERE id_produto = $2
        RETURNING id_produto, codigo, nome, ativo`,
            [ativo, id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json(rows[0]);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao alterar situação do produto.' });
    }
});

export default router;