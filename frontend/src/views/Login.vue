<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api.js';

const router = useRouter();
const login = ref('');
const senha = ref('');
const erro = ref('');
const carregando = ref(false);
const verSenha = ref(false);

async function entrar() {
  erro.value = '';
  carregando.value = true;
  try {
    const { data } = await api.post('/auth/login', {
      login: login.value,
      senha: senha.value,
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    router.push({ name: 'home' });
  } catch (e) {
    erro.value = e.response?.data?.erro || 'Não foi possível conectar ao servidor.';
  } finally {
    carregando.value = false;
  }
}
</script>

<template>
  <div class="pagina">
    <form class="cartao" @submit.prevent="entrar">
      <header class="cabecalho">
        <h1>Controle de <span>Estoque</span></h1>
        <p class="sub">Materiais e EPIs</p>
      </header>

      <label>
        <span class="rotulo">Login</span>
        <input v-model.trim="login" placeholder="Digite seu login" autocomplete="username" autofocus />
      </label>

      <label>
        <span class="rotulo">Senha</span>
        <div class="campo-senha">
          <input v-model="senha" type="text" :class="{ oculta: !verSenha }" placeholder="Digite sua senha"
            autocomplete="off" />
          <button type="button" class="olho" @click="verSenha = !verSenha">
            {{ verSenha ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>
      </label>

      <p v-if="erro" class="erro">{{ erro }}</p>

      <button class="entrar" :disabled="carregando || !login || !senha">
        {{ carregando ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background-color: #111827;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 2px, transparent 2px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 2px, transparent 2px);
  background-size: 56px 56px;
}

.cartao {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 34px 32px 32px;
  background: #0f1b33;
  border: 1px solid #334155;
  border-top: 5px solid #f59e0b;
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
}

.cabecalho {
  text-align: center;
}

h1 {
  margin: 0;
  font-size: 1.8rem;
  line-height: 1.15;
  color: #ffffff;
}

h1 span {
  color: #f59e0b;
}

.sub {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 0.95rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.rotulo {
  font-size: 0.88rem;
  font-weight: 600;
  color: #e5e7eb;
}

.cartao input {
  width: 100%;
  padding: 13px 14px;
  border: 2px solid #94a3b8;
  border-radius: 8px;
  background: #162238;
  font-size: 1rem;
  color: #ffffff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.cartao input::placeholder {
  color: #64748b;
}

.cartao input:hover {
  border-color: #cbd5e1;
}

.cartao input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.25);
}

.oculta {
  -webkit-text-security: disc;
}

.campo-senha {
  position: relative;
}

.campo-senha input {
  padding-right: 92px;
}

.olho {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: 0;
  color: #f59e0b;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 8px;
}

.erro {
  margin: 0;
  padding: 11px 14px;
  background: rgba(220, 38, 38, 0.15);
  color: #fecaca;
  border: 1px solid rgba(248, 113, 113, 0.5);
  border-radius: 8px;
  font-size: 0.92rem;
}

.entrar {
  margin-top: 4px;
  padding: 14px;
  border: 0;
  border-radius: 8px;
  background: #f59e0b;
  color: #111827;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.05s;
}

.entrar:hover:not(:disabled) {
  background: #d97706;
}

.entrar:active:not(:disabled) {
  transform: scale(0.99);
}

.entrar:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>