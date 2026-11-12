import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const modo = process.argv[2];

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const inteiro = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// ---------- dados ----------
const setores = {
    'Produção': ['Carlos Silva', 'Mariana Souza', 'João Pereira', 'Fernanda Lima', 'Ricardo Alves', 'Patrícia Gomes'],
    'Manutenção': ['Roberto Santos', 'Anderson Costa', 'Paulo Ribeiro', 'Luciana Martins', 'Marcos Oliveira'],
    'Logística': ['Juliana Rocha', 'Eduardo Barbosa', 'Camila Nunes', 'Felipe Araújo'],
    'Qualidade': ['Beatriz Carvalho', 'Rafael Mendes', 'Aline Teixeira'],
    'Limpeza': ['Sandra Moreira', 'José Batista', 'Renata Freitas'],
    'Administrativo': ['Gustavo Pinto', 'Daniela Cardoso', 'Thiago Ramos'],
};

const grupos = {
    'EPI': 'Equipamentos de proteção individual',
    'Limpeza': 'Produtos de limpeza e higiene',
    'Mecânica': 'Ferramentas e peças de manutenção mecânica',
    'Elétrica': 'Materiais elétricos',
    'Escritório': 'Papelaria e suprimentos',
};

// [codigo, nome, grupo, tipo, unidade, mínimo, entrada inicial, extras]
// extras: tam (tamanho), val (validade em dias a partir de hoje), baixo, parado
const P = (codigo, nome, grupo, tipo, un, min, ent, extra = {}) => ({ codigo, nome, grupo, tipo, un, min, ent, ...extra });
const produtos = [
    P('1001', 'Luva de proteção', 'EPI', 'EPI', 'par', 10, 40, { tam: 'P', val: 400 }),
    P('1002', 'Luva de proteção', 'EPI', 'EPI', 'par', 10, 60, { tam: 'M', val: 400 }),
    P('1003', 'Luva de proteção', 'EPI', 'EPI', 'par', 10, 40, { tam: 'G', val: 400 }),
    P('1004', 'Capacete de segurança', 'EPI', 'EPI', 'unidade', 5, 25, { val: 900 }),
    P('1005', 'Óculos de proteção', 'EPI', 'EPI', 'unidade', 8, 30, { val: 700 }),
    P('1006', 'Botina de segurança', 'EPI', 'EPI', 'par', 4, 12, { tam: '40', val: 500 }),
    P('1007', 'Botina de segurança', 'EPI', 'EPI', 'par', 4, 14, { tam: '42', val: 500, baixo: true }),
    P('1008', 'Botina de segurança', 'EPI', 'EPI', 'par', 4, 10, { tam: '44', val: 500 }),
    P('1009', 'Protetor auricular', 'EPI', 'EPI', 'par', 20, 100, { val: 20 }),
    P('1010', 'Máscara PFF2', 'EPI', 'EPI', 'unidade', 20, 50, { val: -15 }),
    P('1011', 'Colete refletivo', 'EPI', 'EPI', 'unidade', 5, 20, { tam: 'G', val: 10 }),
    P('1012', 'Luva nitrílica', 'EPI', 'EPI', 'caixa', 3, 10, { tam: 'M', val: -3 }),
    P('2001', 'Detergente 500 ml', 'Limpeza', 'MATERIAL', 'unidade', 12, 60),
    P('2002', 'Desinfetante 2 L', 'Limpeza', 'MATERIAL', 'unidade', 10, 40),
    P('2003', 'Pano de limpeza', 'Limpeza', 'MATERIAL', 'unidade', 15, 50),
    P('2004', 'Vassoura', 'Limpeza', 'MATERIAL', 'unidade', 3, 8),
    P('2005', 'Saco de lixo 100 L', 'Limpeza', 'MATERIAL', 'pacote', 8, 30),
    P('2006', 'Álcool 70%', 'Limpeza', 'MATERIAL', 'litro', 10, 30, { baixo: true }),
    P('3001', 'Chave de fenda', 'Mecânica', 'MATERIAL', 'unidade', 4, 15),
    P('3002', 'Alicate universal', 'Mecânica', 'MATERIAL', 'unidade', 3, 10),
    P('3003', 'Parafuso M8', 'Mecânica', 'MATERIAL', 'caixa', 10, 40),
    P('3004', 'Óleo lubrificante', 'Mecânica', 'MATERIAL', 'litro', 8, 24, { baixo: true }),
    P('3005', 'Rolamento 6204', 'Mecânica', 'MATERIAL', 'unidade', 6, 20),
    P('3006', 'Graxa', 'Mecânica', 'MATERIAL', 'kg', 4, 10, { baixo: true }),
    P('4001', 'Fio elétrico 2,5 mm', 'Elétrica', 'MATERIAL', 'metro', 50, 300),
    P('4002', 'Disjuntor 20 A', 'Elétrica', 'MATERIAL', 'unidade', 5, 15, { parado: true }),
    P('4003', 'Lâmpada LED', 'Elétrica', 'MATERIAL', 'unidade', 15, 50),
    P('4004', 'Fita isolante', 'Elétrica', 'MATERIAL', 'unidade', 10, 30, { baixo: true }),
    P('5001', 'Caneta azul', 'Escritório', 'MATERIAL', 'unidade', 20, 100),
    P('5002', 'Papel A4', 'Escritório', 'MATERIAL', 'resma', 10, 40),
    P('5003', 'Grampeador', 'Escritório', 'MATERIAL', 'unidade', 2, 6, { parado: true }),
    P('5004', 'Clips', 'Escritório', 'MATERIAL', 'caixa', 5, 20, { parado: true }),
    P('5005', 'Pasta suspensa', 'Escritório', 'MATERIAL', 'unidade', 15, 25, { baixo: true }),
    P('1013', 'Luva térmica', 'EPI', 'EPI', 'par', 4, 12, { tam: 'G', val: 300 }),
    P('1014', 'Avental de PVC', 'EPI', 'EPI', 'unidade', 3, 10, { val: 600 }),
    P('1015', 'Respirador semifacial', 'EPI', 'EPI', 'unidade', 4, 12, { val: 450 }),
    P('2007', 'Esponja multiuso', 'Limpeza', 'MATERIAL', 'unidade', 20, 80),
    P('2008', 'Sabão em pó 1 kg', 'Limpeza', 'MATERIAL', 'unidade', 6, 20),
    P('3007', 'Broca 8 mm', 'Mecânica', 'MATERIAL', 'unidade', 5, 18),
    P('4005', 'Pilha AA', 'Elétrica', 'MATERIAL', 'pacote', 6, 24),
    P('4006', 'Tomada 10 A', 'Elétrica', 'MATERIAL', 'unidade', 6, 20),
    P('5006', 'Envelope pardo', 'Escritório', 'MATERIAL', 'unidade', 30, 120),
    P('5007', 'Marcador de texto', 'Escritório', 'MATERIAL', 'unidade', 10, 40),
];

const nomesFuncionarios = Object.entries(setores).flatMap(([setor, nomes]) =>
    nomes.map((nome) => ({ nome, setor }))
);
const matriculasTeste = [
    ...nomesFuncionarios.map((_, i) => String(1001 + i)),
    '9001',
    '9002',
];
const codigosTeste = produtos.map((p) => p.codigo);

// ---------- limpar os dados de teste ----------
// Também remove os dados da versão antiga do script (matrículas T... e códigos T-...)
if (modo === 'limpar') {
    const func = `(SELECT id_funcionario FROM funcionario WHERE matricula = ANY($1) OR matricula LIKE 'T%')`;
    const prod = `(SELECT id_produto FROM produto WHERE codigo = ANY($2) OR codigo LIKE 'T-%')`;
    await pool.query(
        `DELETE FROM movimentacao
      WHERE id_produto IN ${prod}
         OR id_func_retirada IN ${func} OR id_func_solicitante IN ${func}
         OR id_responsavel IN ${func}`,
        [matriculasTeste, codigosTeste]
    );
    const p = await pool.query(
        `DELETE FROM produto WHERE codigo = ANY($1) OR codigo LIKE 'T-%'`,
        [codigosTeste]
    );
    const f = await pool.query(
        `DELETE FROM funcionario WHERE matricula = ANY($1) OR matricula LIKE 'T%'`,
        [matriculasTeste]
    );
    console.log(`Removidos: ${p.rowCount} produtos e ${f.rowCount} funcionários de teste.`);
    await pool.end();
    process.exit(0);
}

// ---------- confere se já existem dados de teste ----------
const { rows: ocupados } = await pool.query(
    `SELECT
     (SELECT COUNT(*) FROM produto WHERE codigo = ANY($1) OR codigo LIKE 'T-%')::int AS produtos,
     (SELECT COUNT(*) FROM funcionario WHERE matricula = ANY($2) OR matricula LIKE 'T%')::int AS funcionarios`,
    [codigosTeste, matriculasTeste]
);
if (ocupados[0].produtos + ocupados[0].funcionarios > 0) {
    console.log(`Já existem ${ocupados[0].produtos} produtos e ${ocupados[0].funcionarios} funcionários com os códigos de teste.`);
    console.log('Se forem dados de teste antigos, rode antes: node popular.js limpar');
    console.log('Se algum for dado seu, NÃO rode o limpar.');
    await pool.end();
    process.exit(1);
}

const client = await pool.connect();
try {
    await client.query('BEGIN');

    // ---------- funcionários ----------
    for (let i = 0; i < nomesFuncionarios.length; i += 1) {
        const { nome, setor } = nomesFuncionarios[i];
        await client.query(
            `INSERT INTO funcionario (matricula, nome, setor) VALUES ($1, $2, $3)`,
            [String(1001 + i), nome, setor]
        );
    }
    const hash = await bcrypt.hash('teste123', 10);
    await client.query(
        `INSERT INTO funcionario (matricula, nome, setor, login, senha_hash, perfil)
     VALUES ('9001', 'Almoxarife Teste', 'Almoxarifado', 'almox', $1, 'ALMOXARIFADO'),
            ('9002', 'Compras Teste', 'Compras', 'compras', $1, 'COMPRAS')`,
        [hash]
    );

    const { rows: funcs } = await client.query(
        `SELECT id_funcionario, setor FROM funcionario
      WHERE matricula = ANY($1) AND matricula NOT IN ('9001', '9002') AND ativo`,
        [matriculasTeste]
    );
    const responsavel = (await client.query(
        `SELECT id_funcionario FROM funcionario WHERE matricula = '9001'`
    )).rows[0].id_funcionario;

    // ---------- grupos ----------
    for (const [nome, descricao] of Object.entries(grupos)) {
        await client.query(
            `INSERT INTO grupo_produto (nome, descricao) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [nome, descricao]
        );
    }
    const mapaGrupos = {};
    for (const g of (await client.query('SELECT id_grupo, nome FROM grupo_produto')).rows) {
        mapaGrupos[g.nome] = g.id_grupo;
    }

    // ---------- produtos ----------
    for (const p of produtos) {
        const r = await client.query(
            `INSERT INTO produto (id_grupo, codigo, nome, tipo, unidade_medida, estoque_atual, estoque_min, tamanho, validade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_produto`,
            [mapaGrupos[p.grupo], p.codigo, p.nome, p.tipo, p.un, p.parado ? p.ent : 0, p.min,
            p.tam ?? null, p.val !== undefined ? dia(p.val) : null]
        );
        p.id = r.rows[0].id_produto;
        p.estoque = p.parado ? p.ent : 0;
        p.vencido = p.val !== undefined && p.val < 0;
    }

    // ---------- movimentações ----------
    const entrada = (p, qtd, dias) =>
        client.query(
            `INSERT INTO movimentacao (id_produto, id_responsavel, quantidade, operacao, status, data_hora, data_conclusao)
       VALUES ($1, $2, $3, 'ENTRADA', 'CONCLUIDA',
               NOW() - make_interval(days => $4::int), NOW() - make_interval(days => $4::int))`,
            [p.id, responsavel, qtd, dias]
        );

    async function saida(p, qtd, dias) {
        const retirou = sorteio(funcs);
        const pediu = Math.random() < 0.3 ? sorteio(funcs) : null;
        const horas = inteiro(0, 9);
        await client.query(
            `INSERT INTO movimentacao (id_produto, id_responsavel, id_func_solicitante, id_func_retirada,
                                 quantidade, operacao, status, setor_na_data, data_hora, data_conclusao)
       VALUES ($1, $2, $3, $4, $5, 'SAIDA', 'CONCLUIDA', $6,
               NOW() - make_interval(days => $7::int, hours => $8::int),
               NOW() - make_interval(days => $7::int, hours => $8::int))`,
            [p.id, responsavel, pediu?.id_funcionario ?? null, retirou.id_funcionario, qtd, retirou.setor, dias, horas]
        );
        p.estoque -= qtd;
    }

    const comMovimento = produtos.filter((p) => !p.parado);
    for (const p of comMovimento) {
        await entrada(p, p.ent, inteiro(50, 55));
        p.estoque = p.ent;
    }

    // saídas aleatórias; os primeiros itens da lista saem mais
    const movimentaveis = comMovimento.filter((p) => !p.vencido);
    for (let i = 0; i < 170; i += 1) {
        const p = movimentaveis[Math.floor(Math.random() ** 1.8 * movimentaveis.length)];
        if (p.estoque <= 0) continue;
        const limite = p.un === 'metro' ? 30 : 4;
        await saida(p, inteiro(1, Math.min(limite, p.estoque)), inteiro(0, 44));
    }

    // produtos marcados como "baixo" ficam abaixo do estoque mínimo
    for (const p of movimentaveis.filter((x) => x.baixo)) {
        while (p.estoque >= p.min && p.estoque > 0) {
            const q = Math.min(Math.max(p.estoque - Math.max(p.min - 2, 0), 1), 6);
            await saida(p, q, inteiro(0, 30));
        }
    }

    // pedidos aguardando atendimento e alguns cancelados
    const disponiveis = movimentaveis.filter((p) => p.estoque >= 2);
    const pedido = (status, horas) => {
        const p = sorteio(disponiveis);
        return client.query(
            `INSERT INTO movimentacao (id_produto, id_func_solicitante, quantidade, operacao, status, data_hora)
       VALUES ($1, $2, $3, 'SAIDA', $4, NOW() - make_interval(hours => $5::int))`,
            [p.id, sorteio(funcs).id_funcionario, inteiro(1, 2), status, horas]
        );
    };
    for (let i = 0; i < 8; i += 1) await pedido('PENDENTE', inteiro(1, 70));
    for (let i = 0; i < 2; i += 1) await pedido('CANCELADA', inteiro(24, 200));

    for (const p of produtos) {
        await client.query('UPDATE produto SET estoque_atual = $1 WHERE id_produto = $2', [p.estoque, p.id]);
    }

    await client.query('COMMIT');

    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM movimentacao`);
    console.log('Dados de teste criados!');
    console.log(`- ${funcs.length + 2} funcionários, ${produtos.length} produtos e ${total.rows[0].n} movimentações no banco`);
    console.log('- Logins de teste: almox / teste123 (Almoxarifado) e compras / teste123 (Compras)');
    console.log('- Para apagar tudo isso depois: node popular.js limpar');
} catch (erro) {
    await client.query('ROLLBACK');
    console.error('Erro, nada foi gravado:', erro.message);
} finally {
    client.release();
    await pool.end();
}