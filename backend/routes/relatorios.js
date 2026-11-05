import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
router.use(autenticar, exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS'));

const DATA = /^\d{4}-\d{2}-\d{2}$/;

class ErroParametro extends Error { }

function periodo(query, val, alias = 'm') {
    const cond = [];
    if (query.de) {
        if (!DATA.test(query.de)) throw new ErroParametro('Data inicial inválida.');
        val.push(query.de);
        cond.push(`${alias}.data_conclusao >= $${val.length}::date`);
    }
    if (query.ate) {
        if (!DATA.test(query.ate)) throw new ErroParametro('Data final inválida.');
        val.push(query.ate);
        cond.push(`${alias}.data_conclusao < ($${val.length}::date + 1)`);
    }
    return cond;
}

const rota = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (erro) {
        if (erro instanceof ErroParametro) return res.status(400).json({ erro: erro.message });
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao gerar relatório.' });
    }
};

router.get('/estoque', rota(async (req, res) => {
    const { tipo, baixo } = req.query;
    const cond = ['p.ativo'];
    const val = [];

    if (tipo === 'MATERIAL' || tipo === 'EPI') {
        val.push(tipo);
        cond.push(`p.tipo = $${val.length}`);
    }
    if (baixo === 'true') cond.push('p.estoque_atual < p.estoque_min');

    const { rows } = await pool.query(
        `SELECT p.id_produto, p.codigo, p.nome, p.tipo, p.tamanho, p.unidade_medida,
            p.estoque_atual, p.estoque_min, g.nome AS grupo,
            (p.estoque_atual < p.estoque_min) AS estoque_baixo
       FROM produto p
       JOIN grupo_produto g ON g.id_grupo = p.id_grupo
      WHERE ${cond.join(' AND ')}
      ORDER BY p.tipo, p.nome, p.tamanho`,
        val
    );
    res.json(rows);
}));

router.get('/consumo', rota(async (req, res) => {
    const { tipo, ordem } = req.query;
    const val = [];
    const noPeriodo = periodo(req.query, val);
    const joinExtra = noPeriodo.length ? `AND ${noPeriodo.join(' AND ')}` : '';

    const where = ['p.ativo'];
    if (tipo === 'MATERIAL' || tipo === 'EPI') {
        val.push(tipo);
        where.push(`p.tipo = $${val.length}`);
    }

    const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 100);
    val.push(limite);

    const direcao = ordem === 'menos' ? 'ASC' : 'DESC';

    
    const { rows } = await pool.query(
        `SELECT p.id_produto, p.codigo, p.nome, p.tipo, p.tamanho, p.unidade_medida,
            COALESCE(SUM(m.quantidade), 0)::int AS total_saidas,
            COUNT(m.id_movimentacao)::int AS qtd_movimentacoes
       FROM produto p
       LEFT JOIN movimentacao m
              ON m.id_produto = p.id_produto
             AND m.operacao = 'SAIDA' AND m.status = 'CONCLUIDA' ${joinExtra}
      WHERE ${where.join(' AND ')}
      GROUP BY p.id_produto
      ORDER BY total_saidas ${direcao}, p.nome
      LIMIT $${val.length}`,
        val
    );
    res.json(rows);
}));

router.get('/sem-movimentacao', rota(async (req, res) => {
    const { tipo } = req.query;
    const val = [];
    const noPeriodo = periodo(req.query, val);
    const filtroPeriodo = noPeriodo.length ? `AND ${noPeriodo.join(' AND ')}` : '';

    const where = ['p.ativo'];
    if (tipo === 'MATERIAL' || tipo === 'EPI') {
        val.push(tipo);
        where.push(`p.tipo = $${val.length}`);
    }

    const { rows } = await pool.query(
        `SELECT p.id_produto, p.codigo, p.nome, p.tipo, p.tamanho, p.estoque_atual,
            (SELECT MAX(x.data_conclusao) FROM movimentacao x
              WHERE x.id_produto = p.id_produto AND x.status = 'CONCLUIDA') AS ultima_movimentacao
       FROM produto p
      WHERE ${where.join(' AND ')}
        AND NOT EXISTS (
          SELECT 1 FROM movimentacao m
           WHERE m.id_produto = p.id_produto AND m.status = 'CONCLUIDA' ${filtroPeriodo}
        )
      ORDER BY p.tipo, p.nome`,
        val
    );
    res.json(rows);
}));


router.get('/epis-por-funcionario', rota(async (req, res) => {
    const val = [];
    const cond = ["m.operacao = 'SAIDA'", "m.status = 'CONCLUIDA'", "p.tipo = 'EPI'", ...periodo(req.query, val)];

    if (req.query.funcionario) {
        val.push(Number(req.query.funcionario));
        cond.push(`f.id_funcionario = $${val.length}`);
    }
    if (req.query.produto) {
        val.push(Number(req.query.produto));
        cond.push(`p.id_produto = $${val.length}`);
    }

    const { rows } = await pool.query(
        `SELECT f.id_funcionario, f.nome AS funcionario, f.setor,
            p.id_produto, p.codigo, p.nome AS produto, p.tamanho,
            SUM(m.quantidade)::int AS quantidade,
            MAX(m.data_conclusao) AS ultima_entrega
       FROM movimentacao m
       JOIN produto p ON p.id_produto = m.id_produto
       JOIN funcionario f ON f.id_funcionario = m.id_func_retirada
      WHERE ${cond.join(' AND ')}
      GROUP BY f.id_funcionario, p.id_produto
      ORDER BY f.nome, p.nome`,
        val
    );
    res.json(rows);
}));


router.get('/tamanhos', rota(async (req, res) => {
    const val = [];
    const cond = ["m.operacao = 'SAIDA'", "m.status = 'CONCLUIDA'", "p.tipo = 'EPI'",
        'p.tamanho IS NOT NULL', ...periodo(req.query, val)];

    const { rows } = await pool.query(
        `SELECT p.tamanho, SUM(m.quantidade)::int AS total
       FROM movimentacao m
       JOIN produto p ON p.id_produto = m.id_produto
      WHERE ${cond.join(' AND ')}
      GROUP BY p.tamanho
      ORDER BY total DESC`,
        val
    );
    res.json(rows);
}));


router.get('/validade', rota(async (req, res) => {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);

    const { rows } = await pool.query(
        `SELECT p.id_produto, p.codigo, p.nome, p.tamanho, p.validade, p.estoque_atual,
            (p.validade - CURRENT_DATE) AS dias_restantes,
            CASE WHEN p.validade < CURRENT_DATE THEN 'VENCIDO' ELSE 'PROXIMO' END AS situacao
       FROM produto p
      WHERE p.ativo AND p.tipo = 'EPI' AND p.validade IS NOT NULL
        AND p.validade <= CURRENT_DATE + $1::int
      ORDER BY p.validade`,
        [dias]
    );
    res.json(rows);
}));


router.get('/mensal', rota(async (req, res) => {
    const agora = new Date().toLocaleDateString('sv-SE').slice(0, 7);
    const mes = req.query.mes || agora;
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErroParametro('Mês inválido. Use AAAA-MM.');

    const { rows } = await pool.query(
        `SELECT
        COALESCE(SUM(m.quantidade) FILTER (WHERE m.operacao = 'ENTRADA'), 0)::int AS entradas,
        COALESCE(SUM(m.quantidade) FILTER (WHERE m.operacao = 'SAIDA'), 0)::int AS saidas,
        COALESCE(SUM(m.quantidade) FILTER (WHERE m.operacao = 'SAIDA' AND p.tipo = 'MATERIAL'), 0)::int AS materiais_utilizados,
        COALESCE(SUM(m.quantidade) FILTER (WHERE m.operacao = 'SAIDA' AND p.tipo = 'EPI'), 0)::int AS epis_entregues
       FROM movimentacao m
       JOIN produto p ON p.id_produto = m.id_produto
      WHERE m.status = 'CONCLUIDA'
        AND m.data_conclusao >= $1::date
        AND m.data_conclusao < ($1::date + interval '1 month')`,
        [`${mes}-01`]
    );
    res.json({ mes, ...rows[0] });
}));


router.get('/por-setor', rota(async (req, res) => {
    const val = [];
    const cond = ["m.operacao = 'SAIDA'", "m.status = 'CONCLUIDA'", ...periodo(req.query, val)];

    const { rows } = await pool.query(
        `SELECT COALESCE(m.setor_na_data, 'Sem setor') AS setor,
            COUNT(*)::int AS movimentacoes,
            SUM(m.quantidade)::int AS total_itens
       FROM movimentacao m
      WHERE ${cond.join(' AND ')}
      GROUP BY m.setor_na_data
      ORDER BY total_itens DESC`,
        val
    );
    res.json(rows);
}));

export default router;