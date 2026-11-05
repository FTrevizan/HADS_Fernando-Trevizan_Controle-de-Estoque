<script setup>
import { ref, watch, onMounted } from 'vue';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const entregas = ref([]);
const funcionarios = ref([]);
const epis = ref([]);
const funcionario = ref('');
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
        if (funcionario.value) params.funcionario = funcionario.value;
        if (produto.value) params.produto = produto.value;
        if (de.value) params.de = de.value;
        if (ate.value) params.ate = ate.value;

        const { data } = await api.get('/epis/entregas', { params });
        entregas.value = data;
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível carregar as entregas.';
    } finally {
        carregando.value = false;
    }
}

function dataFormatada(data) {
    return data ? new Date(data).toLocaleString('pt-BR') : '—';
}

function validadeFormatada(v) {
    return v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—';
}

function situacaoValidade(v) {
    if (!v) return '';
    const dias = Math.floor(
        (new Date(String(v).slice(0, 10) + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000
    );
    if (dias < 0) return 'vencido';
    if (dias <= 30) return 'proximo';
    return '';
}

watch([funcionario, produto, de, ate], carregar);

onMounted(async () => {
    try {
        const [f, p] = await Promise.all([
            api.get('/funcionarios'),
            api.get('/produtos', { params: { tipo: 'EPI' } }),
        ]);
        funcionarios.value = f.data;
        epis.value = p.data;
    } catch {
        funcionarios.value = [];
        epis.value = [];
    }
    carregar();
});
</script>

<template>
    <Topo />

    <main class="conteudo">
        <div class="titulo">
            <h2>Entregas de EPI</h2>
            <router-link to="/movimentacoes/novo" class="botao">+ Registrar entrega</router-link>
        </div>

        <div class="filtros">
            <select v-model="funcionario">
                <option value="">Todos os funcionários</option>
                <option v-for="f in funcionarios" :key="f.id_funcionario" :value="f.id_funcionario">
                    {{ f.nome }} ({{ f.matricula }})
                </option>
            </select>

            <select v-model="produto">
                <option value="">Todos os EPIs</option>
                <option v-for="p in epis" :key="p.id_produto" :value="p.id_produto">
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
                        <th>Funcionário</th>
                        <th>Setor</th>
                        <th>EPI</th>
                        <th>Tamanho</th>
                        <th>Qtd.</th>
                        <th>Validade</th>
                        <th>Registrado por</th>
                    </tr>
                </thead>

                <tbody>
                    <tr v-for="e in entregas" :key="e.id_movimentacao">
                        <td>{{ dataFormatada(e.data) }}</td>
                        <td>
                            {{ e.funcionario }}
                            <small>Matrícula {{ e.matricula }}</small>
                        </td>
                        <td>{{ e.setor_na_data || '—' }}</td>
                        <td>{{ e.codigo }} - {{ e.produto }}</td>
                        <td>{{ e.tamanho || '—' }}</td>
                        <td>{{ e.quantidade }}</td>
                        <td :class="situacaoValidade(e.validade)">
                            {{ validadeFormatada(e.validade) }}
                            <small v-if="situacaoValidade(e.validade) === 'vencido'">Vencido</small>
                            <small v-else-if="situacaoValidade(e.validade) === 'proximo'">Vence em breve</small>
                        </td>
                        <td>{{ e.registrado_por || '—' }}</td>
                    </tr>

                    <tr v-if="carregando">
                        <td colspan="8" class="vazio">Carregando entregas...</td>
                    </tr>
                    <tr v-else-if="entregas.length === 0">
                        <td colspan="8" class="vazio">Nenhuma entrega de EPI encontrada.</td>
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
    font-family: inherit;
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
    vertical-align: top;
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

small {
    display: block;
    color: #6b7280;
    font-size: .8rem;
    margin-top: 2px;
}

td.vencido {
    color: #b91c1c;
    font-weight: 600;
}

td.vencido small {
    color: #b91c1c;
}

td.proximo {
    color: #b45309;
    font-weight: 600;
}

td.proximo small {
    color: #b45309;
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

.vazio {
    text-align: center;
    color: #6b7280;
    padding: 24px;
}
</style>