<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const hoje = new Date().toLocaleDateString('sv-SE');

// cada relatório: rota da API, filtros usados e colunas da tabela
const relatorios = {
    estoque: {
        titulo: 'Estoque atual',
        descricao: 'Quantidade atual de materiais e EPIs. Itens abaixo do mínimo aparecem em vermelho.',
        filtros: ['tipo', 'baixo'],
        colunas: [
            { chave: 'codigo', titulo: 'Código' },
            { chave: 'nome', titulo: 'Produto' },
            { chave: 'tipo', titulo: 'Tipo', fmt: 'tipo' },
            { chave: 'tamanho', titulo: 'Tamanho' },
            { chave: 'grupo', titulo: 'Grupo' },
            { chave: 'estoque_atual', titulo: 'Estoque', classe: (l) => (l.estoque_baixo ? 'ruim' : '') },
            { chave: 'estoque_min', titulo: 'Mínimo' },
        ],
    },
    consumo: {
        titulo: 'Produtos mais e menos utilizados',
        descricao: 'Total de saídas concluídas por produto no período.',
        filtros: ['tipo', 'ordem', 'limite', 'periodo'],
        colunas: [
            { chave: 'codigo', titulo: 'Código' },
            { chave: 'nome', titulo: 'Produto' },
            { chave: 'tamanho', titulo: 'Tamanho' },
            { chave: 'total_saidas', titulo: 'Total de saídas' },
            { chave: 'qtd_movimentacoes', titulo: 'Movimentações' },
        ],
    },
    'sem-movimentacao': {
        titulo: 'Produtos sem movimentação',
        descricao: 'Produtos sem nenhuma entrada ou saída concluída no período.',
        filtros: ['tipo', 'periodo'],
        colunas: [
            { chave: 'codigo', titulo: 'Código' },
            { chave: 'nome', titulo: 'Produto' },
            { chave: 'tipo', titulo: 'Tipo', fmt: 'tipo' },
            { chave: 'tamanho', titulo: 'Tamanho' },
            { chave: 'estoque_atual', titulo: 'Estoque' },
            { chave: 'ultima_movimentacao', titulo: 'Última movimentação', fmt: 'dataNunca' },
        ],
    },
    'epis-por-funcionario': {
        titulo: 'EPIs entregues por funcionário',
        descricao: 'Quantidade de cada EPI entregue a cada funcionário.',
        filtros: ['funcionario', 'produto', 'periodo'],
        colunas: [
            { chave: 'funcionario', titulo: 'Funcionário' },
            { chave: 'setor', titulo: 'Setor' },
            { chave: 'codigo', titulo: 'Código' },
            { chave: 'produto', titulo: 'EPI' },
            { chave: 'tamanho', titulo: 'Tamanho' },
            { chave: 'quantidade', titulo: 'Quantidade' },
            { chave: 'ultima_entrega', titulo: 'Última entrega', fmt: 'data' },
        ],
    },
    tamanhos: {
        titulo: 'Tamanhos de EPI mais utilizados',
        descricao: 'Quantidade entregue de cada tamanho de EPI.',
        filtros: ['periodo'],
        colunas: [
            { chave: 'tamanho', titulo: 'Tamanho' },
            { chave: 'total', titulo: 'Quantidade entregue' },
        ],
    },
    validade: {
        titulo: 'EPIs vencidos e a vencer',
        descricao: 'EPIs vencidos ou com validade nos próximos dias.',
        filtros: ['dias'],
        colunas: [
            { chave: 'codigo', titulo: 'Código' },
            { chave: 'nome', titulo: 'EPI' },
            { chave: 'tamanho', titulo: 'Tamanho' },
            { chave: 'validade', titulo: 'Validade', fmt: 'dia' },
            { chave: 'dias_restantes', titulo: 'Dias restantes' },
            {
                chave: 'situacao', titulo: 'Situação', fmt: 'situacao',
                classe: (l) => (l.situacao === 'VENCIDO' ? 'ruim' : 'aviso')
            },
            { chave: 'estoque_atual', titulo: 'Estoque' },
        ],
    },
    mensal: {
        titulo: 'Resumo do mês',
        descricao: 'Entradas, saídas, materiais utilizados e EPIs entregues no mês.',
        filtros: ['mes'],
        colunas: [],
    },
    'por-setor': {
        titulo: 'Movimentações por setor',
        descricao: 'Saídas concluídas agrupadas pelo setor de quem retirou.',
        filtros: ['periodo'],
        colunas: [
            { chave: 'setor', titulo: 'Setor' },
            { chave: 'movimentacoes', titulo: 'Saídas registradas' },
            { chave: 'total_itens', titulo: 'Total de itens' },
        ],
    },
};

const escolhido = ref('estoque');
const filtros = ref({
    tipo: '', baixo: false, ordem: 'mais', limite: 10, de: '', ate: '',
    funcionario: '', produto: '', dias: 30, mes: hoje.slice(0, 7),
});
const linhas = ref([]);
const resumo = ref(null);
const funcionarios = ref([]);
const epis = ref([]);
const erro = ref('');
const carregando = ref(false);
const emitido = ref('');

const atual = computed(() => relatorios[escolhido.value]);
const usa = (nome) => atual.value.filtros.includes(nome);

const cartoes = computed(() => {
    if (!resumo.value) return [];
    const r = resumo.value;
    return [
        { titulo: 'Entradas no mês (itens)', valor: r.entradas },
        { titulo: 'Saídas no mês (itens)', valor: r.saidas },
        { titulo: 'Materiais utilizados', valor: r.materiais_utilizados },
        { titulo: 'EPIs entregues', valor: r.epis_entregues },
    ];
});

function formatar(valor, fmt) {
    if (fmt === 'dataNunca' && !valor) return 'Nunca movimentado';
    if (valor === null || valor === undefined || valor === '') return '—';
    if (fmt === 'data') return new Date(valor).toLocaleString('pt-BR');
    if (fmt === 'dia') return String(valor).slice(0, 10).split('-').reverse().join('/');
    if (fmt === 'dataNunca') return new Date(valor).toLocaleString('pt-BR');
    if (fmt === 'tipo') return valor === 'EPI' ? 'EPI' : 'Material';
    if (fmt === 'situacao') return valor === 'VENCIDO' ? 'Vencido' : 'Vence em breve';
    return valor;
}

// monta só os parâmetros que o relatório escolhido usa
function montarParams() {
    const f = filtros.value;
    const p = {};
    for (const nome of atual.value.filtros) {
        if (nome === 'baixo') {
            if (f.baixo) p.baixo = 'true';
        } else if (nome === 'periodo') {
            if (f.de) p.de = f.de;
            if (f.ate) p.ate = f.ate;
        } else if (f[nome] !== '' && f[nome] !== null) {
            p[nome] = f[nome];
        }
    }
    return p;
}

async function carregar() {
    erro.value = '';
    carregando.value = true;
    const rel = escolhido.value;
    try {
        const { data } = await api.get(`/relatorios/${rel}`, { params: montarParams() });
        if (rel !== escolhido.value) return; // resposta de um relatório já trocado
        if (rel === 'mensal') {
            resumo.value = data;
            linhas.value = [];
        } else {
            linhas.value = data;
            resumo.value = null;
        }
        emitido.value = new Date().toLocaleString('pt-BR');
    } catch (e) {
        if (rel !== escolhido.value) return;
        erro.value = e.response?.data?.erro || 'Não foi possível gerar o relatório.';
        linhas.value = [];
        resumo.value = null;
    } finally {
        carregando.value = false;
    }
}

function exportar() {
    let cabecalho;
    let dados;
    if (resumo.value) {
        cabecalho = ['Indicador', 'Valor'];
        dados = cartoes.value.map((c) => [c.titulo, c.valor]);
    } else {
        const cols = atual.value.colunas;
        cabecalho = cols.map((c) => c.titulo);
        dados = linhas.value.map((l) => cols.map((c) => formatar(l[c.chave], c.fmt)));
    }
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const texto = [cabecalho, ...dados].map((l) => l.map(esc).join(';')).join('\r\n');

    // BOM para o Excel abrir os acentos corretamente
    const blob = new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${escolhido.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function imprimir() {
    window.print();
}

let espera;
watch([escolhido, filtros], () => {
    clearTimeout(espera);
    espera = setTimeout(carregar, 250);
}, { deep: true });

watch(escolhido, () => {
    linhas.value = [];
    resumo.value = null;
});

onMounted(async () => {
    try {
        const { data } = await api.get('/produtos', { params: { tipo: 'EPI' } });
        epis.value = data;
    } catch {
        epis.value = [];
    }
    try {
        // só administrador e almoxarifado podem listar funcionários
        const { data } = await api.get('/funcionarios');
        funcionarios.value = data;
    } catch {
        funcionarios.value = [];
    }
    carregar();
});
</script>

<template>
    <div class="no-print">
        <Topo />
    </div>

    <main class="conteudo">
        <div class="titulo no-print">
            <h2>Relatórios</h2>
            <div class="botoes">
                <button class="secundario" :disabled="carregando || (!linhas.length && !resumo)" @click="exportar">
                    Exportar CSV
                </button>
                <button class="botao" :disabled="carregando" @click="imprimir">Imprimir</button>
            </div>
        </div>

        <div class="abas no-print">
            <button v-for="(r, chave) in relatorios" :key="chave" :class="['aba', { ativa: escolhido === chave }]"
                @click="escolhido = chave">
                {{ r.titulo }}
            </button>
        </div>

        <div class="filtros no-print">
            <label v-if="usa('tipo')">Tipo
                <select v-model="filtros.tipo">
                    <option value="">Todos</option>
                    <option value="MATERIAL">Material</option>
                    <option value="EPI">EPI</option>
                </select>
            </label>

            <label v-if="usa('ordem')">Ordem
                <select v-model="filtros.ordem">
                    <option value="mais">Mais utilizados</option>
                    <option value="menos">Menos utilizados</option>
                </select>
            </label>

            <label v-if="usa('limite')">Quantidade de itens
                <input v-model.number="filtros.limite" type="number" min="1" max="100" />
            </label>

            <label v-if="usa('funcionario')">Funcionário
                <select v-model="filtros.funcionario">
                    <option value="">Todos</option>
                    <option v-for="f in funcionarios" :key="f.id_funcionario" :value="f.id_funcionario">
                        {{ f.nome }}
                    </option>
                </select>
            </label>

            <label v-if="usa('produto')">EPI
                <select v-model="filtros.produto">
                    <option value="">Todos</option>
                    <option v-for="p in epis" :key="p.id_produto" :value="p.id_produto">
                        {{ p.codigo }} - {{ p.nome }}{{ p.tamanho ? ` (${p.tamanho})` : '' }}
                    </option>
                </select>
            </label>

            <template v-if="usa('periodo')">
                <label>De <input v-model="filtros.de" type="date" /></label>
                <label>Até <input v-model="filtros.ate" type="date" /></label>
            </template>

            <label v-if="usa('dias')">Vencem em até (dias)
                <input v-model.number="filtros.dias" type="number" min="1" max="365" />
            </label>

            <label v-if="usa('mes')">Mês
                <input v-model="filtros.mes" type="month" />
            </label>

            <label v-if="usa('baixo')" class="check">
                <input v-model="filtros.baixo" type="checkbox" /> Somente estoque baixo
            </label>
        </div>

        <p v-if="erro" class="erro no-print">{{ erro }}</p>

        <div class="cabecalho-relatorio">
            <h3>{{ atual.titulo }}</h3>
            <p>{{ atual.descricao }}</p>
            <small v-if="emitido">Emitido em {{ emitido }}</small>
        </div>

        <p v-if="carregando" class="vazio">Gerando relatório...</p>

        <div v-else-if="resumo" class="cartoes">
            <div v-for="c in cartoes" :key="c.titulo" class="cartao">
                <span>{{ c.titulo }}</span>
                <strong>{{ c.valor }}</strong>
            </div>
        </div>

        <div v-else class="tabela-area">
            <table>
                <thead>
                    <tr>
                        <th v-for="c in atual.colunas" :key="c.chave">{{ c.titulo }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(l, i) in linhas" :key="i">
                        <td v-for="c in atual.colunas" :key="c.chave" :class="c.classe ? c.classe(l) : ''">
                            {{ formatar(l[c.chave], c.fmt) }}
                        </td>
                    </tr>
                    <tr v-if="!linhas.length">
                        <td :colspan="atual.colunas.length" class="vazio">Nenhum registro para os filtros escolhidos.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </main>
</template>

<style scoped>
.conteudo {
    padding: 24px 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.titulo {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}

h2 {
    margin: 0;
}

.botoes {
    display: flex;
    gap: 10px;
}

button {
    font-family: inherit;
}

.botao,
.secundario {
    padding: 9px 16px;
    border: 0;
    border-radius: 8px;
    font-size: .92rem;
    font-weight: 600;
    cursor: pointer;
}

.botao {
    background: #2563a8;
    color: #fff;
}

.secundario {
    background: #e5e7eb;
    color: #1f2937;
}

.botao:disabled,
.secundario:disabled {
    opacity: .5;
    cursor: not-allowed;
}

.abas {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}

.aba {
    padding: 8px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    background: #fff;
    color: #334155;
    font-size: .88rem;
    cursor: pointer;
}

.aba:hover {
    border-color: #2563a8;
}

.aba.ativa {
    background: #0f1b33;
    border-color: #0f1b33;
    color: #f59e0b;
    font-weight: 600;
}

.filtros {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: flex-end;
    margin-bottom: 16px;
}

.filtros label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: .85rem;
    font-weight: 600;
    color: #475569;
}

.filtros label.check {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    font-weight: 500;
}

input,
select {
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: .95rem;
    background: #fff;
    font-family: inherit;
}

input[type='checkbox'] {
    padding: 0;
}

.erro {
    color: #b91c1c;
    margin: 0 0 12px;
}

.cabecalho-relatorio {
    margin-bottom: 12px;
}

.cabecalho-relatorio h3 {
    margin: 0 0 4px;
    font-size: 1.2rem;
}

.cabecalho-relatorio p {
    margin: 0 0 2px;
    color: #475569;
    font-size: .92rem;
}

.cabecalho-relatorio small {
    color: #6b7280;
}

.tabela-area {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, .06);
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 11px 14px;
    font-size: .92rem;
}

th {
    background: #f1f5f9;
    color: #475569;
    font-weight: 600;
    white-space: nowrap;
}

tr+tr td {
    border-top: 1px solid #e5e7eb;
}

td.ruim {
    color: #b91c1c;
    font-weight: 600;
}

td.aviso {
    color: #b45309;
    font-weight: 600;
}

.vazio {
    text-align: center;
    color: #6b7280;
    padding: 24px;
}

.cartoes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
}

.cartao {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 20px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, .06);
    border-top: 4px solid #f59e0b;
}

.cartao span {
    color: #475569;
    font-size: .92rem;
}

.cartao strong {
    font-size: 2rem;
    color: #0f1b33;
}

@media print {
    .no-print {
        display: none !important;
    }

    .conteudo {
        padding: 0;
        max-width: none;
    }

    .tabela-area,
    .cartao {
        box-shadow: none;
    }
}
</style>