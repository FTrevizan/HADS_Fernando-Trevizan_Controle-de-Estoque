import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();

class ErroNegocio extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}


router.get('/publico/produtos', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT p.id_produto, p.codigo, p.nome, p.tamanho, p.unidade_medida,
              p.estoque_atual, g.nome AS grupo
         FROM produto p
         JOIN grupo_produto g ON g.id_grupo = p.id_grupo
        WHERE p.ativo AND p.estoque_atual > 0
          AND (p.validade IS NULL OR p.validade >= CURRENT_DATE)
        ORDER BY g.nome, p.nome, p.tamanho`
        );
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao carregar os produtos.' });
    }
});

router.post('/publico', async (req, res) => {
    const matricula = String(req.body?.matricula || '').trim();
    const idProduto = Number(req.body?.id_produto);
    const quantidade = Number(req.body?.quantidade);

    if (!matricula) return res.status(400).json({ erro: 'Informe sua matrícula.' });
    if (!Number.isInteger(idProduto)) return res.status(400).json({ erro: 'Selecione o produto.' });
    if (!Number.isInteger(quantidade) || quantidade < 1) {
        return res.status(400).json({ erro: 'Informe uma quantidade inteira maior que zero.' });
    }

    try {
        const func = (await pool.query(
            'SELECT id_funcionario, nome, ativo FROM funcionario WHERE matricula = $1',
            [matricula]
        )).rows[0];
        if (!func) return res.status(404).json({ erro: 'Matrícula não encontrada.' });
        if (!func.ativo) return res.status(409).json({ erro: 'Funcionário inativo.' });

        const prod = (await pool.query(
            `SELECT nome, ativo, estoque_atual,
              (validade IS NOT NULL AND validade < CURRENT_DATE) AS vencido
         FROM produto WHERE id_produto = $1`,
            [idProduto]
        )).rows[0];
        if (!prod || !prod.ativo) return res.status(404).json({ erro: 'Produto indisponível.' });
        if (prod.vencido) return res.status(409).json({ erro: 'Produto com validade vencida.' });
        if (quantidade > prod.estoque_atual) {
            return res.status(409).json({ erro: `Quantidade indisponível. Disponível: ${prod.estoque_atual}.` });
        }

        const { total } = (await pool.query(
            `SELECT COUNT(*)::int AS total FROM movimentacao
        WHERE id_func_solicitante = $1 AND operacao = 'SAIDA' AND status = 'PENDENTE'`,
            [func.id_funcionario]
        )).rows[0];
        if (total >= 10) {
            return res.status(429).json({ erro: 'Você já tem 10 pedidos pendentes. Aguarde o atendimento.' });
        }

        const { rows } = await pool.query(
            `INSERT INTO movimentacao (id_produto, id_func_solicitante, quantidade, operacao, status)
       VALUES ($1, $2, $3, 'SAIDA', 'PENDENTE')
       RETURNING id_movimentacao`,
            [idProduto, func.id_funcionario, quantidade]
        );

        res.status(201).json({
            id_solicitacao: rows[0].id_movimentacao,
            funcionario: func.nome,
            produto: prod.nome,
            quantidade,
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao registrar a solicitação.' });
    }
});

router.get('/publico/minhas', async (req, res) => {
    const matricula = String(req.query.matricula || '').trim();
    if (!matricula) return res.status(400).json({ erro: 'Informe sua matrícula.' });

    try {
        const func = (await pool.query(
            'SELECT id_funcionario, nome, ativo FROM funcionario WHERE matricula = $1',
            [matricula]
        )).rows[0];
        if (!func) return res.status(404).json({ erro: 'Matrícula não encontrada.' });
        if (!func.ativo) return res.status(409).json({ erro: 'Funcionário inativo.' });

        const { rows } = await pool.query(
            `SELECT m.id_movimentacao, m.quantidade, m.status, m.data_hora AS data_pedido,
              p.nome AS produto, p.tamanho
         FROM movimentacao m
         JOIN produto p ON p.id_produto = m.id_produto
        WHERE m.id_func_solicitante = $1 AND m.operacao = 'SAIDA'
        ORDER BY m.data_hora DESC
        LIMIT 20`,
            [func.id_funcionario]
        );
        res.json({ funcionario: func.nome, pedidos: rows });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao consultar os pedidos.' });
    }
});

router.use(autenticar, exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO'));

router.get('/', async (req, res) => {
    const status = (req.query.status || 'PENDENTE').toUpperCase();
    const val = [];
    let filtro = '';

    if (status !== 'TODAS') {
        val.push(status);
        filtro = `AND m.status = $${val.length}`;
    }
    const ordem = status === 'PENDENTE' ? 'ASC' : 'DESC';

    try {
        const { rows } = await pool.query(
            `SELECT m.id_movimentacao, m.status, m.quantidade,
              m.data_hora AS data_pedido, m.data_conclusao,
              m.id_func_solicitante, sol.nome AS solicitante, sol.setor AS setor_solicitante,
              p.codigo, p.nome AS produto, p.tamanho, p.unidade_medida, p.estoque_atual,
              ret.nome AS retirou, resp.nome AS atendido_por
         FROM movimentacao m
         JOIN produto p ON p.id_produto = m.id_produto
         JOIN funcionario sol ON sol.id_funcionario = m.id_func_solicitante
         LEFT JOIN funcionario ret ON ret.id_funcionario = m.id_func_retirada
         LEFT JOIN funcionario resp ON resp.id_funcionario = m.id_responsavel
        WHERE m.operacao = 'SAIDA' ${filtro}
        ORDER BY m.data_hora ${ordem}
        LIMIT 200`,
            val
        );
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar solicitações.' });
    }
});

async function transacao(res, acao) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await acao(cliente);
        await cliente.query('COMMIT');
        res.json(resultado);
    } catch (erro) {
        await cliente.query('ROLLBACK');
        if (erro instanceof ErroNegocio) return res.status(erro.status).json({ erro: erro.message });
        if (erro.code === '23514') {
            return res.status(409).json({ erro: 'Operação inválida para o estoque atual.' });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao processar a solicitação.' });
    } finally {
        cliente.release();
    }
}

router.post('/:id/atender', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    await transacao(res, async (c) => {
        const sol = (await c.query(
            `SELECT id_produto, quantidade, status, id_func_solicitante
         FROM movimentacao
        WHERE id_movimentacao = $1 AND operacao = 'SAIDA' AND id_func_solicitante IS NOT NULL
          FOR UPDATE`,
            [id]
        )).rows[0];
        if (!sol) throw new ErroNegocio(404, 'Solicitação não encontrada.');
        if (sol.status !== 'PENDENTE') {
            throw new ErroNegocio(409, 'Esta solicitação já foi atendida ou cancelada.');
        }

        const idRetirada = req.body?.id_func_retirada
            ? Number(req.body.id_func_retirada)
            : sol.id_func_solicitante;
        if (!Number.isInteger(idRetirada)) throw new ErroNegocio(400, 'Funcionário inválido.');

        const prod = (await c.query(
            `SELECT ativo, estoque_atual,
              (validade IS NOT NULL AND validade < CURRENT_DATE) AS vencido
         FROM produto WHERE id_produto = $1 FOR UPDATE`,
            [sol.id_produto]
        )).rows[0];
        if (!prod.ativo) throw new ErroNegocio(409, 'Produto desativado.');
        if (prod.vencido) throw new ErroNegocio(409, 'EPI com validade vencida não pode ser entregue.');
        if (prod.estoque_atual < sol.quantidade) {
            throw new ErroNegocio(409, `Estoque insuficiente. Disponível: ${prod.estoque_atual}.`);
        }

        const func = (await c.query(
            'SELECT setor, ativo FROM funcionario WHERE id_funcionario = $1',
            [idRetirada]
        )).rows[0];
        if (!func) throw new ErroNegocio(404, 'Funcionário não encontrado.');
        if (!func.ativo) throw new ErroNegocio(409, 'Funcionário inativo.');

        await c.query(
            `UPDATE movimentacao
          SET status = 'CONCLUIDA', id_responsavel = $1, id_func_retirada = $2,
              setor_na_data = $3, data_conclusao = NOW()
        WHERE id_movimentacao = $4`,
            [req.usuario.id, idRetirada, func.setor, id]
        );
        const novo = await c.query(
            `UPDATE produto SET estoque_atual = estoque_atual - $1
        WHERE id_produto = $2 RETURNING estoque_atual`,
            [sol.quantidade, sol.id_produto]
        );

        return { id_solicitacao: id, status: 'CONCLUIDA', estoque_atual: novo.rows[0].estoque_atual };
    });
});

router.post('/:id/cancelar', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Id inválido.' });

    try {
        const { rows } = await pool.query(
            `UPDATE movimentacao SET status = 'CANCELADA'
        WHERE id_movimentacao = $1 AND operacao = 'SAIDA'
          AND status = 'PENDENTE' AND id_func_solicitante IS NOT NULL
        RETURNING id_movimentacao`,
            [id]
        );
        if (!rows[0]) {
            return res.status(409).json({ erro: 'Solicitação não encontrada ou já finalizada.' });
        }
        res.json({ id_solicitacao: id, status: 'CANCELADA' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao cancelar a solicitação.' });
    }
});

export default router;