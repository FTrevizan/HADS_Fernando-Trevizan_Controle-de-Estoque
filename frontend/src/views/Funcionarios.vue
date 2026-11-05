<script setup>
import { ref, watch, onMounted } from 'vue';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const funcionarios = ref([]);
const busca = ref('');
const filtro = ref('todos'); 
const erro = ref('');
const carregando = ref(false);

async function carregar() {
    erro.value = '';
    carregando.value = true;
    try {
        const params = {};
        if (busca.value.trim()) params.busca = busca.value.trim();
        if (filtro.value === 'ativos') params.ativo = 'true';
        if (filtro.value === 'inativos') params.ativo = 'false';

        const { data } = await api.get('/funcionarios', { params });
        funcionarios.value = data;
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível carregar os funcionários.';
    } finally {
        carregando.value = false;
    }
}

async function alternarAtivo(func) {
    const acao = func.ativo ? 'desativar' : 'reativar';
    if (!confirm(`Deseja ${acao} ${func.nome}?`)) return;

    erro.value = '';
    try {
        await api.patch(`/funcionarios/${func.id_funcionario}/ativo`, { ativo: !func.ativo });
        await carregar();
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível alterar a situação.';
    }
}

let espera;
watch(busca, () => {
    clearTimeout(espera);
    espera = setTimeout(carregar, 300);
});
watch(filtro, carregar);

onMounted(carregar);
</script>

<template>
    <Topo />

    <main class="conteudo">
        <div class="titulo">
            <h2>Funcionários</h2>
            <router-link to="/funcionarios/novo" class="botao">+ Novo funcionário</router-link>
        </div>

        <div class="filtros">
            <input v-model="busca" placeholder="Buscar por nome ou matrícula" />
            <select v-model="filtro">
                <option value="todos">Todos</option>
                <option value="ativos">Somente ativos</option>
                <option value="inativos">Somente inativos</option>
            </select>
        </div>

        <p v-if="erro" class="erro">{{ erro }}</p>

        <div class="tabela-area">
            <table>
                <thead>
                    <tr>
                        <th>Matrícula</th>
                        <th>Nome</th>
                        <th>Setor</th>
                        <th>Acesso</th>
                        <th>Situação</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="f in funcionarios" :key="f.id_funcionario">
                        <td>{{ f.matricula }}</td>
                        <td>{{ f.nome }}</td>
                        <td>{{ f.setor }}</td>
                        <td>{{ f.perfil ? `${f.perfil} (${f.login})` : '—' }}</td>
                        <td>
                            <span :class="['selo', f.ativo ? 'ativo' : 'inativo']">
                                {{ f.ativo ? 'Ativo' : 'Inativo' }}
                            </span>
                        </td>
                        <td class="acoes">
                            <router-link :to="`/funcionarios/${f.id_funcionario}`" class="link">Editar</router-link>
                            <button class="link" @click="alternarAtivo(f)">
                                {{ f.ativo ? 'Desativar' : 'Reativar' }}
                            </button>
                        </td>
                    </tr>
                    <tr v-if="!carregando && funcionarios.length === 0">
                        <td colspan="6" class="vazio">Nenhum funcionário encontrado.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </main>
</template>


<style scoped>
.conteudo {
    padding: 24px 20px;
    max-width: 1000px;
    margin: 0 auto;
}

.titulo {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

h2 {
    margin: 0 0 16px;
}

.filtros {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
}

input,
select {
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: .95rem;
    background: #fff;
}

input {
    flex: 1;
    min-width: 220px;
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
}

tr+tr td {
    border-top: 1px solid #e5e7eb;
}

.selo {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: .8rem;
    font-weight: 600;
}

.selo.ativo {
    background: #dcfce7;
    color: #166534;
}

.selo.inativo {
    background: #fee2e2;
    color: #991b1b;
}

.acoes {
    text-align: right;
    white-space: nowrap;
}

button.link {
    background: none;
    border: 0;
    color: #2563a8;
    cursor: pointer;
    font-size: .9rem;
    padding: 4px 6px;
}

button.link:hover {
    text-decoration: underline;
}

.vazio {
    text-align: center;
    color: #6b7280;
    padding: 24px;
}

a.link {
    color: #2563a8;
    font-size: .9rem;
    padding: 4px 6px;
    text-decoration: none;
}

a.link:hover {
    text-decoration: underline;
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

a.link {
    color: #2563a8;
    font-size: .9rem;
    padding: 4px 6px;
    text-decoration: none;
}

a.link:hover {
    text-decoration: underline;
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