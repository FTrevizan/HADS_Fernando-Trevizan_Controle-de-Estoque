<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api.js';
import Topo from '../components/Topo.vue';
import { SETORES } from '../setores.js';

const route = useRoute();
const router = useRouter();
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
const ehAdmin = usuario.perfil === 'ADMINISTRADOR';

const id = route.params.id; // sem id = cadastro novo
const editando = computed(() => !!id);

const matriculas = ref({ controle: '', rh: '' });
const form = ref({ nome: '', setor: '', login: '', senha: '', perfil: '' });
const temAcesso = ref(false);
const jaTinhaAcesso = ref(false);
const erro = ref('');
const salvando = ref(false);

// se o funcionário tem um setor antigo que não está na lista, ele continua aparecendo
const opcoesSetor = computed(() => {
    const atual = form.value.setor;
    return atual && !SETORES.includes(atual) ? [atual, ...SETORES] : SETORES;
});

onMounted(async () => {
    if (!editando.value) return;
    try {
        const { data } = await api.get(`/funcionarios/${id}`);
        matriculas.value = { controle: data.matricula, rh: data.matricula_rh || '' };
        form.value = {
            nome: data.nome,
            setor: data.setor,
            login: data.login || '',
            senha: '',
            perfil: data.perfil || '',
        };
        temAcesso.value = !!data.login;
        jaTinhaAcesso.value = !!data.login;
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível carregar o funcionário.';
    }
});

async function salvar() {
    erro.value = '';
    salvando.value = true;

    // as matrículas nunca são enviadas: o sistema gera e mantém as duas
    const corpo = { nome: form.value.nome, setor: form.value.setor };

    // só o administrador envia dados de acesso
    if (ehAdmin && temAcesso.value) {
        corpo.login = form.value.login;
        corpo.perfil = form.value.perfil;
        if (form.value.senha) corpo.senha = form.value.senha;
    }

    try {
        if (editando.value) {
            await api.put(`/funcionarios/${id}`, corpo);
            router.push({ name: 'funcionarios' });
        } else {
            const { data } = await api.post('/funcionarios', corpo);
            // a lista mostra a matrícula que o sistema gerou
            router.push({ name: 'funcionarios', query: { nova: data.matricula } });
        }
    } catch (e) {
        erro.value = e.response?.data?.erro || 'Não foi possível salvar.';
    } finally {
        salvando.value = false;
    }
}
</script>

<template>
    <Topo />

    <main class="conteudo">
        <h2>{{ editando ? 'Editar funcionário' : 'Novo funcionário' }}</h2>

        <form class="cartao" @submit.prevent="salvar">
            <!-- edição: as duas matrículas só para consulta -->
            <div v-if="editando" class="linha">
                <label>Matrícula de controle
                    <input :value="matriculas.controle" disabled />
                </label>
                <label>Matrícula do RH
                    <input :value="matriculas.rh" disabled />
                </label>
            </div>

            <!-- cadastro: nada a digitar -->
            <p v-else class="info">
                As matrículas de <strong>controle interno</strong> e do <strong>RH</strong>
                serão geradas automaticamente ao salvar.
            </p>

            <label>Nome
                <input v-model.trim="form.nome" required />
            </label>

            <label>Setor
                <select v-model="form.setor" required>
                    <option value="" disabled>Selecione</option>
                    <option v-for="s in opcoesSetor" :key="s" :value="s">{{ s }}</option>
                </select>
            </label>

            <template v-if="ehAdmin">
                <label v-if="!jaTinhaAcesso" class="check">
                    <input type="checkbox" v-model="temAcesso" />
                    Dar acesso ao sistema (login)
                </label>

                <template v-if="temAcesso">
                    <label>Login
                        <input v-model.trim="form.login" autocomplete="off" />
                    </label>

                    <label>Senha
                        <input v-model="form.senha" type="password" autocomplete="new-password"
                            :placeholder="jaTinhaAcesso ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'" />
                    </label>

                    <label>Perfil
                        <select v-model="form.perfil">
                            <option value="" disabled>Selecione</option>
                            <option value="ADMINISTRADOR">Administrador</option>
                            <option value="ALMOXARIFADO">Almoxarifado</option>
                            <option value="COMPRAS">Compras</option>
                        </select>
                    </label>
                </template>
            </template>

            <p v-if="erro" class="erro">{{ erro }}</p>

            <div class="botoes">
                <button type="button" class="secundario" @click="router.push({ name: 'funcionarios' })">
                    Cancelar
                </button>
                <button :disabled="salvando">{{ salvando ? 'Salvando...' : 'Salvar' }}</button>
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

.linha {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: .9rem;
    font-weight: 600;
}

label.check {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-weight: 500;
}

input,
select {
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 1rem;
    background: #fff;
    font-family: inherit;
    width: 100%;
}

input:disabled {
    background: #f1f5f9;
    color: #475569;
    cursor: not-allowed;
}

input[type='checkbox'] {
    width: 18px;
    height: 18px;
    padding: 0;
}

input:focus,
select:focus {
    outline: 2px solid #2563a8;
    border-color: transparent;
}

.info {
    margin: 0;
    padding: 10px 12px;
    background: #eff6ff;
    color: #1e40af;
    border-radius: 8px;
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

.erro {
    margin: 0;
    color: #b91c1c;
    font-size: .9rem;
}

@media (max-width: 480px) {
    .linha {
        grid-template-columns: 1fr;
    }
}
</style>