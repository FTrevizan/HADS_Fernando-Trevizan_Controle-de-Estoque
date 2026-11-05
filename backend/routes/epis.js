import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
router.use(autenticar, exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS'));

const DATA = /^\d{4}-\d{2}-\d{2}$/;


router.get('/entregas', async (req, res) => {
    const { funcionario, produto, de, ate } = req.query;
    const cond = ["m.operacao = 'SAIDA'", "m.status = 'CONCLUIDA'", "p.tipo = 'EPI'"];
    const val = [];

    if (funcionario) {
        val.push(Number(funcionario));
        cond.push(`f.id_funcionario = $${val.length}`);
    }
    if (produto) {
        val.push(Number(produto));
        cond.push(`p.id_produto = $${val.length}`);
    }
    if (de) {
        if (!DATA.test(de)) return res.status(400).json({ erro: 'Data inicial inválida.' });
        val.push(de);
        cond.push(`m.data_conclusao >= $${val.length}::date`);
    }
    if (ate) {
        if (!DATA.test(ate)) return res.status(400).json({ erro: 'Data final inválida.' });
        val.push(ate);
        cond.push(`m.data_conclusao < ($${val.length}::date + 1)`);
    }

    try {
        const { rows } = await pool.query(
            `SELECT m.id_movimentacao, m.quantidade, m.data_conclusao AS data, m.setor_na_data,
              f.id_funcionario, f.nome AS funcionario, f.matricula,
              p.id_produto, p.codigo, p.nome AS produto, p.tamanho, p.validade,
              resp.nome AS registrado_por
         FROM movimentacao m
         JOIN produto p ON p.id_produto = m.id_produto
         JOIN funcionario f ON f.id_funcionario = m.id_func_retirada
         LEFT JOIN funcionario resp ON resp.id_funcionario = m.id_responsavel
        WHERE ${cond.join(' AND ')}
        ORDER BY m.data_conclusao DESC, m.id_movimentacao DESC
        LIMIT 200`,
            val
        );
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar as entregas de EPI.' });
    }
});

export default router;