<script setup>
import Topo from '../components/Topo.vue';

const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
const podeGerenciar = ['ADMINISTRADOR', 'ALMOXARIFADO'].includes(usuario.perfil);
const primeiroNome = (usuario.nome || '').split(' ')[0];

const atalhos = [
  { para: '/solicitacoes', titulo: 'Solicitações', texto: 'Pedidos aguardando atendimento' },
  { para: '/movimentacoes', titulo: 'Movimentações', texto: 'Entradas e saídas de produtos' },
  { para: '/epis', titulo: 'Entregas de EPI', texto: 'EPIs entregues aos funcionários' },
  { para: '/produtos', titulo: 'Produtos', texto: 'Materiais, EPIs e estoque' },
  { para: '/grupos', titulo: 'Grupos', texto: 'Categorias dos produtos' },
  { para: '/funcionarios', titulo: 'Funcionários', texto: 'Cadastro e acesso ao sistema' },
  { para: '/solicitar', titulo: 'Solicitar produto', texto: 'Página de pedido do funcionário' },
];
</script>

<template>
  <div class="pagina">
    <Topo />

    <main class="conteudo">
      <h1>Olá, {{ primeiroNome }}!</h1>
      <p class="sub">O que você quer fazer hoje?</p>

      <div v-if="podeGerenciar" class="grade">
        <router-link v-for="a in atalhos" :key="a.para" :to="a.para" class="atalho">
          <strong>{{ a.titulo }}</strong>
          <span>{{ a.texto }}</span>
        </router-link>
      </div>

      <p v-else class="aviso">Seu perfil ainda não possui telas disponíveis.</p>
    </main>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
  background: #0f1b33;
  color: #e5e7eb;
}

.conteudo {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px;
}

h1 {
  margin: 0 0 6px;
  font-size: 2rem;
  color: #fff;
}

.sub {
  margin: 0 0 32px;
  color: #9ca3af;
  font-size: 1.05rem;
}

.grade {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 18px;
}

.atalho {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  border-radius: 14px;
  text-decoration: none;
  background: #162238;
  border: 2px solid #334155;
  transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
}

.atalho strong {
  font-size: 1.2rem;
  color: #f59e0b;
}

.atalho span {
  color: #cbd5e1;
  font-size: .95rem;
}

.atalho:hover {
  border-color: #f59e0b;
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.aviso {
  color: #9ca3af;
}
</style>