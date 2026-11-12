<script setup>
import { ref, watch, onMounted } from 'vue';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const lista = ref([]);
const funcionarios = ref([]);

const status = ref('PENDENTE');
const erro = ref('');
const sucesso = ref('');

const carregando = ref(false);
const salvando = ref(false);

const atendendo = ref(null);
const retirada = ref('');

const rotulos = {
    PENDENTE: 'Aguardando',
    CONCLUIDA: 'Entregue',
    CANCELADA: 'Cancelado'
};

async function carregar() {
    erro.value = '';
    carregando.value = true;
    atendendo.value = null;

    try {
        const { data } = await api.get('/solicitacoes', {
            params: { status: status.value }
        });

        lista.value = data;
    } catch (e) {
        erro.value = e.response?.data?.erro ||
            'Não foi possível carregar as solicitações.';
        lista.value = [];
    } finally {
        carregando.value = false;
    }
}

async function carregarFuncionarios() {
    try {
        const { data } = await api.get('/funcionarios', {
            params: { ativo: 'true' }
        });

        funcionarios.value = data;
    } catch (e) {
        funcionarios.value = [];
        erro.value = 'Não foi possível carregar os funcionários.';
    }
}

function dataFormatada(data) {
    return data
        ? new Date(data).toLocaleString('pt-BR')
        : '—';
}

function nomeProduto(s) {
    return `${s.codigo} - ${s.produto}${s.tamanho ? ` (${s.tamanho})` : ''}`;
}

function abrirAtender(s) {
    erro.value = '';
    sucesso.value = '';

    atendendo.value = s.id_movimentacao;
    retirada.value = s.id_func_solicitante;
}

async function confirmarAtender(s) {
    if (!retirada.value) {
        erro.value = 'Selecione o funcionário que está retirando o produto.';
        return;
    }

    erro.value = '';
    sucesso.value = '';
    salvando.value = true;

    try {
        const { data } = await api.post(
            `/solicitacoes/${s.id_movimentacao}/atender`,
            {
                id_func_retirada: retirada.value
            }
        );

        await carregar();

        sucesso.value =
            `Entrega registrada com sucesso! Estoque atual: ${data.estoque_atual}.`;

    } catch (e) {
        erro.value = e.response?.data?.erro ||
            'Não foi possível atender a solicitação.';
    } finally {
        salvando.value = false;
    }
}

async function cancelar(s) {
    if (!confirm(`Cancelar o pedido de ${s.solicitante}?`)) {
        return;
    }

    erro.value = '';
    sucesso.value = '';

    try {
        await api.post(
            `/solicitacoes/${s.id_movimentacao}/cancelar`
        );

        await carregar();

        sucesso.value = 'Solicitação cancelada com sucesso.';

    } catch (e) {
        erro.value = e.response?.data?.erro ||
            'Não foi possível cancelar a solicitação.';
    }
}

watch(status, () => {
    sucesso.value = '';
    carregar();
});

onMounted(async () => {
    await Promise.all([
        carregarFuncionarios(),
        carregar()
    ]);
});
</script>

<template>
    <Topo />

    <main class="conteudo">

        <div class="titulo">
            <h2>Solicitações</h2>

            <select v-model="status">
                <option value="PENDENTE">Aguardando atendimento</option>
                <option value="CONCLUIDA">Entregues</option>
                <option value="CANCELADA">Canceladas</option>
                <option value="TODAS">Todas</option>
            </select>
        </div>

        <p v-if="sucesso" class="sucesso">
            {{ sucesso }}
        </p>

        <p v-if="erro" class="erro">
            {{ erro }}
        </p>

        <div class="tabela-area">

            <table>
                <thead>
                    <tr>
                        <th>Pedido em</th>
                        <th>Solicitante</th>
                        <th>Produto</th>
                        <th>Qtd.</th>
                        <th>Estoque</th>
                        <th>Situação</th>
                        <th>Ações</th>
                    </tr>
                </thead>

                <tbody>
                    <template v-for="s in lista" :key="s.id_movimentacao">
                        <tr>
                            <td>
                                {{ dataFormatada(s.data_pedido) }}
                            </td>

                            <td>
                                {{ s.solicitante }}

                                <small v-if="s.setor_solicitante">
                                    {{ s.setor_solicitante }}
                                </small>
                            </td>

                            <td>
                                {{ nomeProduto(s) }}
                            </td>

                            <td>
                                {{ s.quantidade }}
                            </td>

                            <td :class="{
                                falta: s.status === 'PENDENTE'
                                    && s.estoque_atual < s.quantidade
                            }">
                                {{ s.estoque_atual }}
                                {{ s.unidade_medida }}
                            </td>

                            <td>
                                <span :class="['selo', s.status.toLowerCase()]">
                                    {{ rotulos[s.status] }}
                                </span>

                                <small v-if="s.status === 'CONCLUIDA'">
                                    Retirado por {{ s.retirou }}
                                    <br>
                                    Atendido por {{ s.atendido_por }}
                                </small>
                            </td>

                            <td class="acoes">
                                <template v-if="s.status === 'PENDENTE'">

                                    <button class="link" :disabled="salvando" @click="abrirAtender(s)">
                                        Atender
                                    </button>

                                    <button class="link perigo" :disabled="salvando" @click="cancelar(s)">
                                        Cancelar
                                    </button>

                                </template>
                            </td>
                        </tr>

                        <tr v-if="atendendo === s.id_movimentacao" class="atender">
                            <td colspan="7">

                                <div class="linha-atendimento">

                                    <label>
                                        Quem está retirando?

                                        <select v-model="retirada">
                                            <option v-for="f in funcionarios" :key="f.id_funcionario"
                                                :value="f.id_funcionario">
                                                {{ f.nome }} ({{ f.matricula }})
                                            </option>
                                        </select>
                                    </label>

                                    <button class="botao" :disabled="salvando || !funcionarios.length"
                                        @click="confirmarAtender(s)">
                                        {{
                                            salvando
                                                ? 'Salvando...'
                                                : 'Confirmar entrega'
                                        }}
                                    </button>

                                    <button class="secundario" :disabled="salvando" @click="atendendo = null">
                                        Fechar
                                    </button>

                                </div>

                            </td>
                        </tr>

                    </template>

                    <tr v-if="carregando">
                        <td colspan="7" class="vazio">
                            Carregando solicitações...
                        </td>
                    </tr>

                    <tr v-else-if="lista.length === 0">
                        <td colspan="7" class="vazio">
                            Nenhuma solicitação encontrada.
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

select {
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: .95rem;
    background: #fff;
    font-family: inherit;
}

.erro {
    color: #b91c1c;
    margin: 0 0 12px;
}

.sucesso {
    margin: 0 0 12px;
    padding: 10px 14px;
    background: #dcfce7;
    color: #166534;
    border-radius: 8px;
    font-size: .92rem;
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

td.falta {
    color: #b91c1c;
    font-weight: 600;
}

.selo {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: .8rem;
    font-weight: 600;
}

.selo.pendente {
    background: #fef3c7;
    color: #92400e;
}

.selo.concluida {
    background: #dcfce7;
    color: #166534;
}

.selo.cancelada {
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

button.link.perigo {
    color: #b91c1c;
}

button:disabled {
    opacity: .5;
    cursor: not-allowed;
}

tr.atender td {
    background: #f8fafc;
}

.linha-atendimento {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
}

.linha-atendimento label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: .88rem;
    font-weight: 600;
}

.botao,
.secundario {
    padding: 10px 16px;
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

.vazio {
    text-align: center;
    color: #6b7280;
    padding: 24px;
}
</style>
