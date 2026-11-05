<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const router = useRouter();

const produtos = ref([]);
const funcionarios = ref([]);
const form = ref({ operacao: 'ENTRADA', id_produto: '', id_func_retirada: '', quantidade: 1 });
const erro = ref('');
const sucesso = ref('');
const salvando = ref(false);

const ehSaida = computed(() => form.value.operacao === 'SAIDA');
const produtoSelecionado = computed(() =>
    produtos.value.find((p) => p.id_produto === form.value.id_produto)
);

const vencido = computed(() => {
    const v = produtoSelecionado.value?.validade;
    return !!v && v < new Date().toLocaleDateString('sv-SE');
});

async function carregarProdutos() {
    const { data } = await api.get('/produtos', { params: { ativo: 'true' } });
    produtos.value = data;
}

onMounted(async () => {
    try {
        await carregarProdutos();
        const { data } = await api.get('/funcionarios', { params: { ativo: 'true' } });
        funcionarios.value = data;
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível carregar os dados.';
    }
});

async function salvar() {
    erro.value = '';
    sucesso.value = '';
    salvando.value = true;

    const corpo = { id_produto: form.value.id_produto, quantidade: form.value.quantidade };
    if (ehSaida.value) corpo.id_func_retirada = form.value.id_func_retirada;

    try {
        const rota = ehSaida.value ? '/movimentacoes/saida' : '/movimentacoes/entrada';
        const { data } = await api.post(rota, corpo);

        sucesso.value = `${ehSaida.value ? 'Saída' : 'Entrada'} registrada. Estoque atual: ${data.estoque_atual}.`;
        form.value.quantidade = 1;
        form.value.id_func_retirada = '';
        await carregarProdutos(); // atualiza o estoque mostrado na lista
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível registrar a movimentação.';
    } finally {
        salvando.value = false;
    }
}
</script>

<template>
    <Topo />

    <main class="conteudo">
        <h2>Nova movimentação</h2>

        <form class="cartao" @submit.prevent="salvar">
            <label>Tipo de movimentação
                <select v-model="form.operacao">
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                </select>
            </label>

            <label>Produto
                <select v-model="form.id_produto" required>
                    <option value="" disabled>Selecione</option>
                    <option v-for="p in produtos" :key="p.id_produto" :value="p.id_produto">
                        {{ p.codigo }} - {{ p.nome }}{{ p.tamanho ? ` (${p.tamanho})` : '' }}
                    </option>
                </select>
            </label>

            <p v-if="produtoSelecionado" class="info">
                Estoque atual: <strong>{{ produtoSelecionado.estoque_atual }} {{ produtoSelecionado.unidade_medida
                    }}</strong>
            </p>
            <p v-if="ehSaida && vencido" class="erro">Este produto está com a validade vencida e não pode ser entregue.
            </p>

            <label v-if="ehSaida">Quem está retirando
                <select v-model="form.id_func_retirada" required>
                    <option value="" disabled>Selecione</option>
                    <option v-for="f in funcionarios" :key="f.id_funcionario" :value="f.id_funcionario">
                        {{ f.nome }} ({{ f.matricula }})
                    </option>
                </select>
            </label>

            <label>Quantidade
                <input v-model.number="form.quantidade" type="number" min="1" step="1" required />
            </label>

            <p v-if="sucesso" class="sucesso">{{ sucesso }}</p>
            <p v-if="erro" class="erro">{{ erro }}</p>

            <div class="botoes">
                <button type="button" class="secundario" @click="router.push({ name: 'movimentacoes' })">
                    Ver histórico
                </button>
                <button :disabled="salvando || (ehSaida && vencido)">
                    {{ salvando ? 'Salvando...' : 'Registrar' }}
                </button>
            </div>
        </form>
    </main>
</template>

<style scoped>
.conteudo {
    padding: 24px 20px;
    max-width: 520px;
    margin: 0 auto;
}

h2 {
    margin: 0 0 16px;
}

.cartao {
    background: #fff;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, .06);
    display: flex;
    flex-direction: column;
    gap: 14px;
}

label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: .9rem;
    font-weight: 600;
}

input,
select {
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    background: #fff;
}

input:focus,
select:focus {
    outline: 2px solid #2563a8;
    border-color: transparent;
}

.info {
    margin: 0;
    color: #475569;
    font-size: .92rem;
    background: #f1f5f9;
    padding: 10px 12px;
    border-radius: 8px;
}

.sucesso {
    margin: 0;
    color: #166534;
    background: #dcfce7;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: .92rem;
}

.erro {
    margin: 0;
    color: #b91c1c;
    font-size: .9rem;
}

.botoes {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
}

button {
    padding: 10px 18px;
    border: 0;
    border-radius: 8px;
    background: #2563a8;
    color: #fff;
    font-size: .95rem;
    font-weight: 600;
    cursor: pointer;
}

button.secundario {
    background: #e5e7eb;
    color: #1f2937;
}

button:disabled {
    opacity: .5;
    cursor: not-allowed;
}
</style>