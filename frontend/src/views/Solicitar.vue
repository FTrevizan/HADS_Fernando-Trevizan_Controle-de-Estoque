<script setup>
import { ref, computed } from 'vue';
import api from '../api.js';

const matricula = ref('');
const funcionario = ref('');
const pedidos = ref([]);
const produtos = ref([]);
const identificado = ref(false);
const form = ref({ id_produto: '', quantidade: 1 });
const erro = ref('');
const sucesso = ref('');
const carregando = ref(false);

const rotulos = { PENDENTE: 'Aguardando', CONCLUIDA: 'Entregue', CANCELADA: 'Cancelado' };

const produtoSelecionado = computed(() =>
    produtos.value.find((p) => p.id_produto === form.value.id_produto)
);

const grupos = computed(() => {
    const mapa = {};
    for (const p of produtos.value) (mapa[p.grupo] ||= []).push(p);
    return Object.entries(mapa);
});

function nomeProduto(p) {
    return `${p.codigo} - ${p.nome}${p.tamanho ? ` (${p.tamanho})` : ''}`;
}

function dataFormatada(data) {
    return data ? new Date(data).toLocaleString('pt-BR') : '—';
}

async function carregarPedidos() {
    const { data } = await api.get('/solicitacoes/publico/minhas', {
        params: { matricula: matricula.value.trim() },
    });
    funcionario.value = data.funcionario;
    pedidos.value = data.pedidos;
}

async function carregarProdutos() {
    const { data } = await api.get('/solicitacoes/publico/produtos');
    produtos.value = data;
}

async function identificar() {
    erro.value = '';
    sucesso.value = '';
    carregando.value = true;
    try {
        await carregarPedidos();
        await carregarProdutos();
        identificado.value = true;
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível conectar ao servidor.';
    } finally {
        carregando.value = false;
    }
}

async function solicitar() {
    erro.value = '';
    sucesso.value = '';
    carregando.value = true;
    try {
        await api.post('/solicitacoes/publico', {
            matricula: matricula.value.trim(),
            id_produto: form.value.id_produto,
            quantidade: form.value.quantidade,
        });
        sucesso.value = 'Pedido enviado! Aguarde o atendimento do almoxarifado.';
        form.value = { id_produto: '', quantidade: 1 };
        await carregarPedidos();
        await carregarProdutos();
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível enviar o pedido.';
    } finally {
        carregando.value = false;
    }
}

function trocar() {
    identificado.value = false;
    matricula.value = '';
    funcionario.value = '';
    pedidos.value = [];
    form.value = { id_produto: '', quantidade: 1 };
    erro.value = '';
    sucesso.value = '';
}
</script>

<template>
    <div class="pagina">
        <div class="cartao">
            <h1>Solicitar produto</h1>

            <form v-if="!identificado" class="form" @submit.prevent="identificar">
                <p class="sub">Informe sua matrícula para continuar</p>

                <label>
                    <span>Matrícula</span>
                    <input v-model.trim="matricula" placeholder="Digite sua matrícula" autofocus />
                </label>

                <p v-if="erro" class="erro">{{ erro }}</p>

                <button class="principal" :disabled="carregando || !matricula">
                    {{ carregando ? 'Verificando...' : 'Continuar' }}
                </button>
                <router-link to="/login" class="voltar">Acesso do almoxarifado</router-link>
            </form>

            <template v-else>
                <p class="sub">Olá, <strong>{{ funcionario }}</strong></p>

                <form class="form" @submit.prevent="solicitar">
                    <label>
                        <span>Produto</span>
                        <select v-model="form.id_produto" required>
                            <option value="" disabled>Selecione</option>
                            <optgroup v-for="[nome, lista] in grupos" :key="nome" :label="nome">
                                <option v-for="p in lista" :key="p.id_produto" :value="p.id_produto">
                                    {{ nomeProduto(p) }}
                                </option>
                            </optgroup>
                        </select>
                    </label>

                    <p v-if="produtoSelecionado" class="info">
                        Disponível:
                        <strong>{{ produtoSelecionado.estoque_atual }} {{ produtoSelecionado.unidade_medida }}</strong>
                    </p>

                    <label>
                        <span>Quantidade</span>
                        <input v-model.number="form.quantidade" type="number" min="1"
                            :max="produtoSelecionado?.estoque_atual" required />
                    </label>

                    <p v-if="sucesso" class="sucesso">{{ sucesso }}</p>
                    <p v-if="erro" class="erro">{{ erro }}</p>

                    <button class="principal" :disabled="carregando || !form.id_produto">
                        {{ carregando ? 'Enviando...' : 'Solicitar' }}
                    </button>
                    <button type="button" class="voltar" @click="trocar">Trocar matrícula</button>
                </form>

                <div v-if="pedidos.length" class="pedidos">
                    <h2>Meus pedidos</h2>
                    <ul>
                        <li v-for="p in pedidos" :key="p.id_movimentacao">
                            <div>
                                <strong>{{ p.produto }}{{ p.tamanho ? ` (${p.tamanho})` : '' }}</strong>
                                <small>{{ p.quantidade }} un. · {{ dataFormatada(p.data_pedido) }}</small>
                            </div>
                            <span :class="['selo', p.status.toLowerCase()]">{{ rotulos[p.status] }}</span>
                        </li>
                    </ul>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.pagina {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background-color: #1f2937;
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.05) 2px, transparent 2px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.05) 2px, transparent 2px);
    background-size: 56px 56px;
}

.cartao {
    width: 100%;
    max-width: 440px;
    padding: 32px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}

h1 {
    margin: 0 0 4px;
    text-align: center;
    font-size: 1.5rem;
    color: #111827;
}

.sub {
    margin: 0 0 18px;
    text-align: center;
    color: #6b7280;
}

.form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

label {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

label span {
    font-size: 0.88rem;
    font-weight: 600;
    color: #111827;
}

input,
select {
    width: 100%;
    padding: 12px 14px;
    border: 2px solid #94a3b8;
    border-radius: 8px;
    font-size: 1rem;
    background: #fff;
    color: #111827;
    font-family: inherit;
}

input:focus,
select:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.25);
}

.info {
    margin: 0;
    padding: 10px 12px;
    background: #f1f5f9;
    border-radius: 8px;
    color: #475569;
    font-size: 0.92rem;
}

.sucesso {
    margin: 0;
    padding: 10px 12px;
    background: #dcfce7;
    color: #166534;
    border-radius: 8px;
    font-size: 0.92rem;
}

.erro {
    margin: 0;
    padding: 10px 12px;
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    font-size: 0.92rem;
}

.principal {
    padding: 13px;
    border: 0;
    border-radius: 8px;
    background: #f59e0b;
    color: #111827;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
}

.principal:hover:not(:disabled) {
    background: #d97706;
}

.principal:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.voltar {
    background: none;
    border: 0;
    color: #6b7280;
    font-size: 0.9rem;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    padding: 4px;
}

.voltar:hover {
    color: #111827;
    text-decoration: underline;
}

.pedidos {
    margin-top: 24px;
    border-top: 1px solid #e5e7eb;
    padding-top: 16px;
}

.pedidos h2 {
    margin: 0 0 10px;
    font-size: 1.05rem;
    color: #111827;
}

.pedidos ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
}

.pedidos li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 8px;
}

.pedidos li div {
    display: flex;
    flex-direction: column;
}

.pedidos small {
    color: #6b7280;
}

.selo {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
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
</style>