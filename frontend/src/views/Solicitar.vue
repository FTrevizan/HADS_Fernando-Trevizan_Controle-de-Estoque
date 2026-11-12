<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api.js';

const router = useRouter();

const funcionarios = ref([]);
const produtos = ref([]);

const matricula = ref('');
const idProduto = ref('');
const quantidade = ref(1);

const erro = ref('');
const sucesso = ref('');
const carregando = ref(true);
const salvando = ref(false);

const produtoSelecionado = computed(() => {
    return produtos.value.find(
        p => p.id_produto === Number(idProduto.value)
    );
});

// funcionários agrupados por setor, para a lista de seleção
const funcionariosPorSetor = computed(() => {
    const mapa = {};
    for (const f of funcionarios.value) (mapa[f.setor || 'Sem setor'] ||= []).push(f);
    return Object.entries(mapa);
});

// volta para a tela anterior; se não houver, vai para o login
function voltar() {
    if (window.history.state?.back) router.back();
    else router.push({ name: 'login' });
}

async function carregarFuncionarios() {
    try {
        const { data } = await api.get('/solicitacoes/publico/funcionarios');
        funcionarios.value = data;
    } catch (e) {
        erro.value = e.response?.data?.erro ||
            'Não foi possível carregar a lista de funcionários.';
    }
}

async function carregarProdutos() {
    try {
        const { data } = await api.get('/solicitacoes/publico/produtos');
        produtos.value = data;
    } catch (e) {
        erro.value = e.response?.data?.erro ||
            'Não foi possível carregar os produtos.';
    }
}

async function carregar() {
    carregando.value = true;
    erro.value = '';

    await Promise.all([
        carregarFuncionarios(),
        carregarProdutos()
    ]);

    carregando.value = false;
}

async function solicitar() {
    erro.value = '';
    sucesso.value = '';

    if (!matricula.value) {
        erro.value = 'Selecione seu nome.';
        return;
    }

    if (!idProduto.value) {
        erro.value = 'Selecione um produto.';
        return;
    }

    if (!Number.isInteger(Number(quantidade.value)) ||
        Number(quantidade.value) < 1) {
        erro.value = 'Informe uma quantidade válida.';
        return;
    }

    if (produtoSelecionado.value &&
        Number(quantidade.value) > produtoSelecionado.value.estoque_atual) {
        erro.value = 'Quantidade maior que o estoque disponível.';
        return;
    }

    salvando.value = true;

    try {
        const { data } = await api.post('/solicitacoes/publico', {
            matricula: matricula.value,
            id_produto: Number(idProduto.value),
            quantidade: Number(quantidade.value)
        });

        sucesso.value =
            `Solicitação registrada com sucesso! Pedido de ${data.produto}, quantidade: ${data.quantidade}.`;

        idProduto.value = '';
        quantidade.value = 1;

        await carregarProdutos();
    } catch (e) {
        erro.value = e.response?.data?.erro ||
            'Não foi possível registrar a solicitação.';
    } finally {
        salvando.value = false;
    }
}

onMounted(carregar);
</script>

<template>
    <main class="pagina">

        <div class="cartao">

            <div class="topo">
                <button type="button" class="voltar" @click="voltar">
                    ← Voltar
                </button>
            </div>

            <div class="cabecalho">
                <h2>Solicitar Produto</h2>
                <p>
                    Preencha os dados abaixo para solicitar
                    um produto ao almoxarifado.
                </p>
            </div>

            <p v-if="erro" class="erro">
                {{ erro }}
            </p>

            <p v-if="sucesso" class="sucesso">
                {{ sucesso }}
            </p>

            <div v-if="carregando" class="carregando">
                Carregando informações...
            </div>

            <form v-else @submit.prevent="solicitar">

                <div class="campo">
                    <label for="funcionario">
                        Funcionário
                    </label>

                    <select id="funcionario" v-model="matricula" required>
                        <option value="">Selecione</option>

                        <optgroup v-for="[setor, lista] in funcionariosPorSetor" :key="setor" :label="setor">
                            <option v-for="f in lista" :key="f.matricula" :value="f.matricula">
                                {{ f.nome }} ({{ f.matricula }})
                            </option>
                        </optgroup>
                    </select>

                    <small v-if="funcionarios.length === 0">
                        Nenhum funcionário disponível.
                    </small>
                </div>

                <div class="campo">
                    <label for="produto">
                        Produto
                    </label>

                    <select id="produto" v-model="idProduto" required>
                        <option value="">Selecione um produto</option>

                        <option v-for="p in produtos" :key="p.id_produto" :value="String(p.id_produto)">
                            {{ p.codigo }} - {{ p.nome }}
                            {{ p.tamanho ? `(${p.tamanho})` : '' }}
                        </option>
                    </select>

                    <small v-if="produtos.length === 0">
                        Nenhum produto disponível.
                    </small>
                </div>

                <div v-if="produtoSelecionado" class="estoque">
                    <span>Estoque disponível:</span>

                    <strong>
                        {{ produtoSelecionado.estoque_atual }}
                        {{ produtoSelecionado.unidade_medida }}
                    </strong>
                </div>

                <div class="campo">
                    <label for="quantidade">
                        Quantidade
                    </label>

                    <input id="quantidade" v-model.number="quantidade" type="number" min="1"
                        :max="produtoSelecionado?.estoque_atual" required />
                </div>

                <button type="submit" class="botao" :disabled="salvando ||
                    !funcionarios.length ||
                    !produtos.length">
                    {{ salvando ? 'Enviando...' : 'Enviar solicitação' }}
                </button>

            </form>

        </div>

    </main>
</template>

<style scoped>
.pagina {
    min-height: 100vh;
    padding: 40px 20px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    background: #0f1b33;
}

.cartao {
    width: 100%;
    max-width: 550px;
    padding: 30px;
    background: #162238;
    border: 2px solid #334155;
    border-radius: 14px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.25);
}

.topo {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 25px;
}

.voltar {
    padding: 9px 16px;
    border: 2px solid #334155;
    border-radius: 8px;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
}

.voltar:hover {
    background: #334155;
    color: #ffffff;
}

.cabecalho {
    margin-bottom: 28px;
    text-align: center;
}

.cabecalho h2 {
    margin: 0 0 10px;
    color: #f1f5f9;
    font-size: 1.6rem;
    font-weight: 700;
}

.cabecalho p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.95rem;
    line-height: 1.5;
}

.campo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
}

.campo label {
    color: #e2e8f0;
    font-size: 0.92rem;
    font-weight: 600;
}

select,
input {
    width: 100%;
    padding: 12px 14px;
    border: 2px solid #334155;
    border-radius: 8px;
    background: #1e293b;
    color: #f1f5f9;
    font-family: inherit;
    font-size: 0.95rem;
    outline: none;
    transition: 0.2s;
}

select:focus,
input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

select {
    cursor: pointer;
}

select option {
    background: #1e293b;
    color: #f1f5f9;
}

select optgroup {
    background: #162238;
    color: #f59e0b;
    font-style: normal;
}

input:disabled,
select:disabled {
    background: #334155;
    cursor: not-allowed;
}

small {
    display: block;
    margin-top: 2px;
    color: #94a3b8;
    font-size: 0.8rem;
}

.estoque {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin: -5px 0 20px;
    padding: 14px 15px;
    border: 2px solid #334155;
    border-radius: 8px;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 0.9rem;
}

.estoque strong {
    color: #60a5fa;
    font-weight: 700;
}

.erro {
    margin: 0 0 18px;
    padding: 12px 15px;
    border: 1px solid #991b1b;
    border-radius: 8px;
    background: #450a0a;
    color: #fecaca;
    font-size: 0.9rem;
    line-height: 1.5;
}

.sucesso {
    margin: 0 0 18px;
    padding: 12px 15px;
    border: 1px solid #166534;
    border-radius: 8px;
    background: #052e16;
    color: #bbf7d0;
    font-size: 0.9rem;
    line-height: 1.5;
}

.carregando {
    padding: 30px 10px;
    color: #94a3b8;
    text-align: center;
    font-size: 0.95rem;
}

.botao {
    width: 100%;
    padding: 13px 18px;
    border: 2px solid #2563a8;
    border-radius: 8px;
    background: #2563a8;
    color: #ffffff;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
}

.botao:hover:not(:disabled) {
    background: #1d4f85;
    border-color: #1d4f85;
    transform: translateY(-1px);
}

.botao:active:not(:disabled) {
    transform: translateY(0);
}

.botao:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

@media (max-width: 600px) {
    .pagina {
        padding: 20px 12px;
    }

    .cartao {
        padding: 22px 16px;
    }

    .cabecalho h2 {
        font-size: 1.4rem;
    }
}
</style>