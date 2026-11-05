<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const movimentacoes = ref([]);
const produtos = ref([]);
const busca = ref('');
const operacao = ref('');
const produto = ref('');
const de = ref('');
const ate = ref('');
const erro = ref('');
const carregando = ref(false);

async function carregar() {
    erro.value = '';
    carregando.value = true;
    try {
        const params = {};
        if (operacao.value) params.operacao = operacao.value;
        if (produto.value) params.produto = produto.value;
        if (de.value) params.de = de.value;
        if (ate.value) params.ate = ate.value;

        const { data } = await api.get('/movimentacoes', { params });
        movimentacoes.value = data;
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível carregar as movimentações.';
    } finally {
        carregando.value = false;
    }
}

const lista = computed(() => {
    const termo = busca.value.trim().toLowerCase();
    if (!termo) return movimentacoes.value;
    return movimentacoes.value.filter((m) =>
        [m.produto, m.codigo, m.retirou, m.responsavel]
            .filter(Boolean)
            .some((texto) => texto.toLowerCase().includes(termo))
    );
});

function nomeProduto(m) {
    return `${m.codigo} - ${m.produto}${m.tamanho ? ` (${m.tamanho})` : ''}`;
}

function dataFormatada(data) {
    if (!data) return '—';
    const valor = new Date(data);
    return Number.isNaN(valor.getTime()) ? data : valor.toLocaleString('pt-BR');
}

watch([operacao, produto, de, ate], carregar);

onMounted(async () => {
    try {
        const { data } = await api.get('/produtos');
        produtos.value = data;
    } catch {
        produtos.value = [];
    }
    carregar();
});
</script>

<template>
    <Topo />

    <main class="conteudo">
        <div class="titulo">
            <h2>Movimentações</h2>
            <router-link to="/movimentacoes/novo" class="botao">+ Nova movimentação</router-link>
        </div>

        <div class="filtros">
            <input v-model="busca" placeholder="Buscar produto, código ou funcionário" />

            <select v-model="operacao">
                <option value="">Entradas e saídas</option>
                <option value="ENTRADA">Somente entradas</option>
                <option value="SAIDA">Somente saídas</option>
            </select>

            <select v-model="produto">
                <option value="">Todos os produtos</option>
                <option v-for="p in produtos" :key="p.id_produto" :value="p.id_produto">
                    {{ p.codigo }} - {{ p.nome }}{{ p.tamanho ? ` (${p.tamanho})` : '' }}
                </option>
            </select>

            <label class="data">De <input v-model="de" type="date" /></label>
            <label class="data">Até <input v-model="ate" type="date" /></label>
        </div>

        <p v-if="erro" class="erro">{{ erro }}</p>

        <div class="tabela-area">
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Produto</th>
                        <th>Tipo</th>
                        <th>Quantidade</th>
                        <th>Retirado por</th>
                        <th>Registrado por</th>
                        <th>Setor</th>
                    </tr>
                </thead>

                <tbody>
                    <tr v-for="m in lista" :key="m.id_movimentacao">
                        <td>{{ dataFormatada(m.data) }}</td>
                        <td>{{ nomeProduto(m) }}</td>
                        <td>
                            <span :class="['selo', m.operacao === 'ENTRADA' ? 'entrada' : 'saida']">
                                {{ m.operacao === 'ENTRADA' ? 'Entrada' : 'Saída' }}
                            </span>
                        </td>
                        <td>{{ m.quantidade }}</td>
                        <td>{{ m.retirou || '—' }}</td>
                        <td>{{ m.responsavel || '—' }}</td>
                        <td>{{ m.setor_na_data || '—' }}</td>
                    </tr>

                    <tr v-if="carregando">
                        <td colspan="7" class="vazio">Carregando movimentações...</td>
                    </tr>
                    <tr v-else-if="lista.length === 0">
                        <td colspan="7" class="vazio">Nenhuma movimentação encontrada.</td>
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

.filtros {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
    align-items: center;
}

input,
select {
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: .95rem;
    background: #fff;
}

.filtros>input:first-child {
    flex: 1;
    min-width: 220px;
}

label.data {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: .92rem;
}

.erro {
    color: #b91c1c;
    margin: 0 0 12px;
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

.selo {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: .8rem;
    font-weight: 600;
}

.selo.entrada {
    background: #dcfce7;
    color: #166534;
}

.selo.saida {
    background: #fee2e2;
    color: #991b1b;
}

.vazio {
    text-align: center;
    color: #6b7280;
    padding: 24px;
}

.botao {
    background: #2563a8;
    color: #fff;
    text-decoration: none;
    padding: 9px 16px;
    border-radius: 8px;
    font-size: .92rem;
    font-weight: 600;
}
</style>