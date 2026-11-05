<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const route = useRoute();
const router = useRouter();
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
const ehAdmin = usuario.perfil === 'ADMINISTRADOR';

const id = route.params.id; 
const editando = computed(() => !!id);

const form = ref({ matricula: '', nome: '', setor: '', login: '', senha: '', perfil: '' });
const temAcesso = ref(false);
const jaTinhaAcesso = ref(false);
const erro = ref('');
const salvando = ref(false);

onMounted(async () => {
    if (!editando.value) return;
    try {
        const { data } = await api.get(`/funcionarios/${id}`);
        form.value = {
            matricula: data.matricula,
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

    const corpo = {
        matricula: form.value.matricula,
        nome: form.value.nome,
        setor: form.value.setor,
    };

    if (ehAdmin && temAcesso.value) {
        corpo.login = form.value.login;
        corpo.perfil = form.value.perfil;
        if (form.value.senha) corpo.senha = form.value.senha;
    }

    try {
        if (editando.value) {
            await api.put(`/funcionarios/${id}`, corpo);
        } else {
            await api.post('/funcionarios', corpo);
        }
        router.push({ name: 'funcionarios' });
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
            <label>Matrícula
                <input v-model.trim="form.matricula" required />
            </label>

            <label>Nome
                <input v-model.trim="form.nome" required />
            </label>

            <label>Setor
                <input v-model.trim="form.setor" required />
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
</style>