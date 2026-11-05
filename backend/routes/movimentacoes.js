import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
router.use(autenticar);

const gerenciar = exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO');
const consultar = exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS');

class ErroNegocio extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}


async function bloquearProduto(cliente, id) {
    const { rows } = await cliente.query(
        `SELECT id_produto, nome, ativo, estoque_atual,
            (validade IS NOT NULL AND validade < CURRENT_DATE) AS vencido
       FROM produto
      WHERE id_produto = $1
        FOR UPDATE`,
        [id]
    );
    if (!rows[0]) throw new ErroNegocio(404, 'Produto não encontrado.');
    if (!rows[0].ativo) throw new ErroNegocio(409, 'Produto desativado.');
    return rows[0];
}

async function executar(res, acao) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await acao(cliente);
        await cliente.query('COMMIT');
        res.status(201).json(resultado);
    } catch (erro) {
        await cliente.query('ROLLBACK');
        if (erro instanceof ErroNegocio) {
            return res.status(erro.status).json({ erro: erro.message });
        }
        if (erro.code === '23503') {
            return res.status(400).json({ erro: 'Funcionário inválido.' });
        }
        if (erro.code === '23514') {
            return res.status(409).json({ erro: 'Operação inválida para o estoque atual.' });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao registrar movimentação.' });
    } finally {
        cliente.release();
    }
}

function lerQuantidade(valor) {
    const q = Number(valor);
    return Number.isInteger(q) && q > 0 ? q : null;
}

// ENTRADA: soma ao estoque
router.post('/entrada', gerenciar, async (req, res) => {
    const idProduto = Number(req.body?.id_produto);
    const quantidade = lerQuantidade(req.body?.quantidade);

    if (!Number.isInteger(idProduto)) return res.status(400).json({ erro: 'Selecione o produto.' });
    if (!quantidade) return res.status(400).json({ erro: 'Informe uma quantidade inteira maior que zero.' });

    await executar(res, async (c) => {
        await bloquearProduto(c, idProduto);

        const mov = await c.query(
            `INSERT INTO movimentacao
         (id_produto, id_responsavel, quantidade, operacao, status, data_conclusao)
       VALUES ($1, $2, $3, 'ENTRADA', 'CONCLUIDA', NOW())
       RETURNING id_movimentacao`,
            [idProduto, req.usuario.id, quantidade]
        );
        const prod = await c.query(
            `UPDATE produto SET estoque_atual = estoque_atual + $1
        WHERE id_produto = $2 RETURNING estoque_atual`,
            [quantidade, idProduto]
        );

        return {
            id_movimentacao: mov.rows[0].id_movimentacao,
            operacao: 'ENTRADA',
            quantidade,
            estoque_atual: prod.rows[0].estoque_atual,
        };
    });
});

// SAÍDA: subtrai do estoque e registra quem retirou
router.post('/saida', gerenciar, async (req, res) => {
    const idProduto = Number(req.body?.id_produto);
    const idRetirada = Number(req.body?.id_func_retirada);
    const idSolicitante = req.body?.id_func_solicitante ? Number(req.body.id_func_solicitante) : null;
    const quantidade = lerQuantidade(req.body?.quantidade);

    if (!Number.isInteger(idProduto)) return res.status(400).json({ erro: 'Selecione o produto.' });
    if (!Number.isInteger(idRetirada)) return res.status(400).json({ erro: 'Informe quem está retirando.' });
    if (!quantidade) return res.status(400).json({ erro: 'Informe uma quantidade inteira maior que zero.' });

    await executar(res, async (c) => {
        const produto = await bloquearProduto(c, idProduto);

        if (produto.vencido) {
            throw new ErroNegocio(409, 'EPI com validade vencida não pode ser entregue.');
        }
        if (produto.estoque_atual < quantidade) {
            throw new ErroNegocio(409, `Estoque insuficiente. Disponível: ${produto.estoque_atual}.`);
        }

        const func = await c.query(
            'SELECT setor, ativo FROM funcionario WHERE id_funcionario = $1',
            [idRetirada]
        );
        if (!func.rows[0]) throw new ErroNegocio(404, 'Funcionário não encontrado.');
        if (!func.rows[0].ativo) throw new ErroNegocio(409, 'Funcionário inativo.');

        // setor_na_data guarda o setor de quem retirou no momento da saída
        const mov = await c.query(
            `INSERT INTO movimentacao
         (id_produto, id_responsavel, id_func_solicitante, id_func_retirada,
          quantidade, operacao, status, setor_na_data, data_conclusao)
       VALUES ($1, $2, $3, $4, $5, 'SAIDA', 'CONCLUIDA', $6, NOW())
       RETURNING id_movimentacao`,
            [idProduto, req.usuario.id, idSolicitante, idRetirada, quantidade, func.rows[0].setor]
        );
        const prod = await c.query(
            `UPDATE produto SET estoque_atual = estoque_atual - $1
        WHERE id_produto = $2 RETURNING estoque_atual`,
            [quantidade, idProduto]
        );

        return {
            id_movimentacao: mov.rows[0].id_movimentacao,
            operacao: 'SAIDA',
            quantidade,
            estoque_atual: prod.rows[0].estoque_atual,
        };
    });
});

// HISTÓRICO: filtros produto, funcionario (retirada), operacao, status, de, ate
router.get('/', consultar, async (req, res) => {
    const { produto, funcionario, operacao, de, ate } = req.query;
    const status = (req.query.status || 'CONCLUIDA').toUpperCase();
    const cond = [];
    const val = [];

    if (status !== 'TODAS') {
        val.push(status);
        cond.push(`m.status = $${val.length}`);
    }
    if (produto) {
        val.push(Number(produto));
        cond.push(`m.id_produto = $${val.length}`);
    }
    if (funcionario) {
        val.push(Number(funcionario));
        cond.push(`m.id_func_retirada = $${val.length}`);
    }
    if (operacao === 'ENTRADA' || operacao === 'SAIDA') {
        val.push(operacao);
        cond.push(`m.operacao = $${val.length}`);
    }
    if (de) {
        val.push(de);
        cond.push(`COALESCE(m.data_conclusao, m.data_hora) >= $${val.length}::date`);
    }
    if (ate) {
        val.push(ate);
        cond.push(`COALESCE(m.data_conclusao, m.data_hora) < ($${val.length}::date + 1)`);
    }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    try {
        const { rows } = await pool.query(
            `SELECT m.id_movimentacao, m.operacao, m.status, m.quantidade, m.setor_na_data,
              COALESCE(m.data_conclusao, m.data_hora) AS data,
              p.codigo, p.nome AS produto, p.tamanho,
              resp.nome AS responsavel,
              ret.nome  AS retirou,
              sol.nome  AS solicitante
         FROM movimentacao m
         JOIN produto p ON p.id_produto = m.id_produto
         LEFT JOIN funcionario resp ON resp.id_funcionario = m.id_responsavel
         LEFT JOIN funcionario ret  ON ret.id_funcionario  = m.id_func_retirada
         LEFT JOIN funcionario sol  ON sol.id_funcionario  = m.id_func_solicitante
         ${where}
        ORDER BY COALESCE(m.data_conclusao, m.data_hora) DESC, m.id_movimentacao DESC
        LIMIT 200`,
            val
        );
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar movimentações.' });
    }
});

export default router;