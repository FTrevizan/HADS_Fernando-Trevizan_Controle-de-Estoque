import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
router.use(autenticar, exigirPerfil('ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS'));

router.get('/', async (req, res) => {
    try {
        const [resumo, estoqueBaixo, validade, ultimas] = await Promise.all([
            pool.query(
                `SELECT
           (SELECT COUNT(*) FROM produto WHERE ativo)::int AS produtos_ativos,
           (SELECT COUNT(*) FROM produto
             WHERE ativo AND estoque_atual < estoque_min)::int AS estoque_baixo,
           (SELECT COUNT(*) FROM produto
             WHERE ativo AND tipo = 'EPI' AND validade IS NOT NULL
               AND validade < CURRENT_DATE)::int AS epis_vencidos,
           (SELECT COUNT(*) FROM produto
             WHERE ativo AND tipo = 'EPI' AND validade IS NOT NULL
               AND validade >= CURRENT_DATE
               AND validade <= CURRENT_DATE + 30)::int AS epis_a_vencer,
           (SELECT COUNT(*) FROM movimentacao
             WHERE operacao = 'SAIDA' AND status = 'PENDENTE'
               AND id_func_solicitante IS NOT NULL)::int AS solicitacoes_pendentes,
           (SELECT COUNT(*) FROM movimentacao
             WHERE status = 'CONCLUIDA'
               AND data_conclusao >= date_trunc('month', CURRENT_DATE))::int AS movimentacoes_mes`
            ),
            // os 8 produtos mais abaixo do mínimo
            pool.query(
                `SELECT id_produto, codigo, nome, tamanho, unidade_medida, estoque_atual, estoque_min
           FROM produto
          WHERE ativo AND estoque_atual < estoque_min
          ORDER BY (estoque_min - estoque_atual) DESC, nome
          LIMIT 8`
            ),
            // EPIs vencidos ou que vencem em até 30 dias
            pool.query(
                `SELECT id_produto, codigo, nome, tamanho, validade, estoque_atual,
                (validade - CURRENT_DATE) AS dias_restantes
           FROM produto
          WHERE ativo AND tipo = 'EPI' AND validade IS NOT NULL
            AND validade <= CURRENT_DATE + 30
          ORDER BY validade
          LIMIT 8`
            ),
            // últimas movimentações concluídas
            pool.query(
                `SELECT m.id_movimentacao, m.operacao, m.quantidade, m.data_conclusao AS data,
                p.codigo, p.nome AS produto, p.tamanho,
                ret.nome AS retirou, resp.nome AS registrado_por
           FROM movimentacao m
           JOIN produto p ON p.id_produto = m.id_produto
           LEFT JOIN funcionario ret ON ret.id_funcionario = m.id_func_retirada
           LEFT JOIN funcionario resp ON resp.id_funcionario = m.id_responsavel
          WHERE m.status = 'CONCLUIDA'
          ORDER BY m.data_conclusao DESC, m.id_movimentacao DESC
          LIMIT 8`
            ),
        ]);

        res.json({
            resumo: resumo.rows[0],
            estoque_baixo: estoqueBaixo.rows,
            validade: validade.rows,
            ultimas: ultimas.rows,
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao carregar o painel.' });
    }
});

export default router;