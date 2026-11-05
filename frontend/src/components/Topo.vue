<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
const podeGerenciar = ['ADMINISTRADOR', 'ALMOXARIFADO'].includes(usuario.perfil);

function sair() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    router.push({ name: 'login' });
}
</script>

<template>
    <header class="topo">
        <strong class="marca">Controle de Estoque</strong>

        <nav>
            <router-link to="/">Início</router-link>
            <router-link v-if="podeGerenciar" to="/solicitacoes">Solicitações</router-link>
            <router-link v-if="podeGerenciar" to="/movimentacoes">Movimentações</router-link>
            <router-link v-if="podeGerenciar" to="/epis">Entregas de EPI</router-link>
            <router-link v-if="podeGerenciar" to="/produtos">Produtos</router-link>
            <router-link v-if="podeGerenciar" to="/grupos">Grupos</router-link>
            <router-link v-if="podeGerenciar" to="/funcionarios">Funcionários</router-link>
            <router-link v-if="podeGerenciar" to="/solicitar">Solicitar produto</router-link>
        </nav>

        <span class="quem">{{ usuario.nome }} · {{ usuario.perfil }}</span>
        <button @click="sair">Sair</button>
    </header>
</template>

<style scoped>
.topo {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 12px 24px;
    background: #0b1220;
    color: #fff;
    border-bottom: 2px solid #f59e0b;
}

.marca {
    color: #f59e0b;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
}

nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

nav a {
    color: #cbd5e1;
    text-decoration: none;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: .95rem;
    transition: background 0.15s, color 0.15s;
}

nav a:hover {
    background: rgba(255, 255, 255, .1);
    color: #fff;
}

nav a.router-link-active {
    background: #f59e0b;
    color: #0b1220;
    font-weight: 600;
}

.quem {
    margin-left: auto;
    font-size: .9rem;
    color: #cbd5e1;
}

button {
    padding: 7px 16px;
    border: 1.5px solid #f59e0b;
    border-radius: 8px;
    background: transparent;
    color: #f59e0b;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

button:hover {
    background: #f59e0b;
    color: #0b1220;
}
</style>