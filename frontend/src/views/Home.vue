<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../api.js';
import Topo from '../components/Topo.vue';

const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
const primeiroNome = (usuario.nome || '').split(' ')[0];

const gestao = ['ADMINISTRADOR', 'ALMOXARIFADO'];
const todos = ['ADMINISTRADOR', 'ALMOXARIFADO', 'COMPRAS'];
const ehGestao = gestao.includes(usuario.perfil);

const painel = ref(null);
const erro = ref('');
const carregando = ref(true);

const hora = new Date().getHours();
const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
const hoje = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

// cartões de resumo; cada um só aparece para quem pode abrir a tela
const cartoes = computed(() => {
  if (!painel.value) return [];
  const r = painel.value.resumo;
  const lista = [
    {
      titulo: 'Estoque baixo', valor: r.estoque_baixo, para: '/relatorios', perfis: todos,
      tom: r.estoque_baixo > 0 ? 'ruim' : 'ok', texto: 'produtos abaixo do mínimo'
    },
    {
      titulo: 'EPIs vencidos', valor: r.epis_vencidos, para: '/relatorios', perfis: todos,
      tom: r.epis_vencidos > 0 ? 'ruim' : 'ok', texto: 'não podem ser entregues'
    },
    {
      titulo: 'EPIs a vencer', valor: r.epis_a_vencer, para: '/relatorios', perfis: todos,
      tom: r.epis_a_vencer > 0 ? 'aviso' : 'ok', texto: 'vencem em até 30 dias'
    },
    {
      titulo: 'Solicitações', valor: r.solicitacoes_pendentes, para: '/solicitacoes', perfis: gestao,
      tom: r.solicitacoes_pendentes > 0 ? 'aviso' : 'ok', texto: 'aguardando atendimento'
    },
    {
      titulo: 'Movimentações no mês', valor: r.movimentacoes_mes, para: '/movimentacoes', perfis: gestao,
      tom: 'neutro', texto: 'entradas e saídas'
    },
    {
      titulo: 'Produtos ativos', valor: r.produtos_ativos, para: '/produtos', perfis: gestao,
      tom: 'neutro', texto: 'cadastrados no sistema'
    },
  ];
  return lista.filter((c) => c.perfis.includes(usuario.perfil));
});

const atalhos = [
  { para: '/solicitacoes', titulo: 'Solicitações', texto: 'Atender pedidos', perfis: gestao },
  { para: '/movimentacoes/novo', titulo: 'Registrar movimentação', texto: 'Entrada ou saída', perfis: gestao },
  { para: '/epis', titulo: 'Entregas de EPI', texto: 'Quem recebeu o quê', perfis: gestao },
  { para: '/produtos', titulo: 'Produtos', texto: 'Materiais, EPIs e estoque', perfis: gestao },
  { para: '/grupos', titulo: 'Grupos', texto: 'Categorias dos produtos', perfis: gestao },
  { para: '/funcionarios', titulo: 'Funcionários', texto: 'Cadastro e acessos', perfis: gestao },
  { para: '/relatorios', titulo: 'Relatórios', texto: 'Estoque, consumo e validade', perfis: todos },
  { para: '/solicitar', titulo: 'Solicitar produto', texto: 'Página de pedido', perfis: gestao },
].filter((a) => a.perfis.includes(usuario.perfil));

function nomeProduto(p) {
  return `${p.nome}${p.tamanho ? ` (${p.tamanho})` : ''}`;
}

function dia(v) {
  return String(v).slice(0, 10).split('-').reverse().join('/');
}

function textoValidade(p) {
  const d = Number(p.dias_restantes);
  if (d < 0) return `Vencido há ${Math.abs(d)} dia${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoje';
  return `Vence em ${d} dia${d === 1 ? '' : 's'}`;
}

function dataHora(v) {
  return v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

onMounted(async () => {
  try {
    const { data } = await api.get('/dashboard');
    painel.value = data;
  } catch (e) {
    erro.value = e.response?.data?.erro || 'Não foi possível carregar o painel.';
  } finally {
    carregando.value = false;
  }
});
</script>

<template>
  <div class="pagina">
    <Topo />

    <main class="conteudo">
      <header class="boas-vindas">
        <div>
          <h1>{{ saudacao }}, {{ primeiroNome }}!</h1>
          <p class="data">{{ hoje }}</p>
        </div>
        <span class="perfil">{{ usuario.perfil }}</span>
      </header>

      <p v-if="erro" class="erro">{{ erro }}</p>
      <p v-else-if="carregando" class="vazio">Carregando painel...</p>

      <template v-else-if="painel">
        <!-- resumo -->
        <section class="cartoes">
          <router-link v-for="c in cartoes" :key="c.titulo" :to="c.para" :class="['cartao', c.tom]">
            <span class="rotulo">{{ c.titulo }}</span>
            <strong>{{ c.valor }}</strong>
            <small>{{ c.texto }}</small>
          </router-link>
        </section>

        <!-- alertas -->
        <section class="duas-colunas">
          <div class="painel">
            <div class="painel-topo">
              <h2>Precisam de reposição</h2>
              <router-link to="/relatorios">Ver relatório</router-link>
            </div>
            <ul v-if="painel.estoque_baixo.length" class="lista">
              <li v-for="p in painel.estoque_baixo" :key="p.id_produto">
                <div>
                  <strong>{{ nomeProduto(p) }}</strong>
                  <small>{{ p.codigo }}</small>
                </div>
                <span class="selo ruim">{{ p.estoque_atual }} / {{ p.estoque_min }} {{ p.unidade_medida }}</span>
              </li>
            </ul>
            <p v-else class="tudo-certo">Nenhum produto abaixo do estoque mínimo.</p>
          </div>

          <div class="painel">
            <div class="painel-topo">
              <h2>Validade dos EPIs</h2>
              <router-link to="/relatorios">Ver relatório</router-link>
            </div>
            <ul v-if="painel.validade.length" class="lista">
              <li v-for="p in painel.validade" :key="p.id_produto">
                <div>
                  <strong>{{ nomeProduto(p) }}</strong>
                  <small>{{ p.codigo }} · validade {{ dia(p.validade) }}</small>
                </div>
                <span :class="['selo', Number(p.dias_restantes) < 0 ? 'ruim' : 'aviso']">
                  {{ textoValidade(p) }}
                </span>
              </li>
            </ul>
            <p v-else class="tudo-certo">Nenhum EPI vencido ou perto de vencer.</p>
          </div>
        </section>

        <!-- últimas movimentações (só para quem pode abrir a tela) -->
        <section v-if="ehGestao" class="painel">
          <div class="painel-topo">
            <h2>Últimas movimentações</h2>
            <router-link to="/movimentacoes">Ver histórico</router-link>
          </div>
          <div v-if="painel.ultimas.length" class="tabela-area">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Qtd.</th>
                  <th>Retirado por</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in painel.ultimas" :key="m.id_movimentacao">
                  <td>{{ dataHora(m.data) }}</td>
                  <td>{{ nomeProduto({ nome: m.produto, tamanho: m.tamanho }) }}</td>
                  <td>
                    <span :class="['selo', m.operacao === 'ENTRADA' ? 'entrada' : 'saida']">
                      {{ m.operacao === 'ENTRADA' ? 'Entrada' : 'Saída' }}
                    </span>
                  </td>
                  <td>{{ m.quantidade }}</td>
                  <td>{{ m.retirou || '—' }}</td>
                  <td>{{ m.registrado_por || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="tudo-certo">Ainda não há movimentações registradas.</p>
        </section>

        <!-- atalhos -->
        <section>
          <h2 class="titulo-secao">Acesso rápido</h2>
          <div class="atalhos">
            <router-link v-for="a in atalhos" :key="a.para" :to="a.para" class="atalho">
              <strong>{{ a.titulo }}</strong>
              <span>{{ a.texto }}</span>
            </router-link>
          </div>
        </section>
      </template>
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
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px 48px;
  display: grid;
  gap: 28px;
}

.boas-vindas {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: 1.9rem;
  color: #fff;
}

.data {
  margin: 4px 0 0;
  color: #94a3b8;
  text-transform: capitalize;
}

.perfil {
  padding: 5px 14px;
  border: 1.5px solid #f59e0b;
  border-radius: 999px;
  color: #f59e0b;
  font-size: .8rem;
  font-weight: 700;
  letter-spacing: .06em;
}

.erro {
  color: #fecaca;
  background: rgba(220, 38, 38, .15);
  border: 1px solid rgba(248, 113, 113, .5);
  padding: 12px 14px;
  border-radius: 8px;
}

.vazio {
  color: #94a3b8;
}

/* cartões de resumo */
.cartoes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
}

.cartao {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  text-decoration: none;
  background: #162238;
  border: 2px solid #334155;
  border-radius: 14px;
  transition: transform .1s, border-color .15s;
}

.cartao:hover {
  transform: translateY(-2px);
  border-color: #f59e0b;
}

.cartao .rotulo {
  color: #cbd5e1;
  font-size: .88rem;
  font-weight: 600;
}

.cartao strong {
  font-size: 2.3rem;
  line-height: 1.1;
  color: #fff;
}

.cartao small {
  color: #94a3b8;
  font-size: .82rem;
}

.cartao.ruim {
  border-left: 6px solid #ef4444;
}

.cartao.ruim strong {
  color: #fca5a5;
}

.cartao.aviso {
  border-left: 6px solid #f59e0b;
}

.cartao.aviso strong {
  color: #fcd34d;
}

.cartao.ok {
  border-left: 6px solid #22c55e;
}

.cartao.neutro {
  border-left: 6px solid #64748b;
}

/* painéis */
.duas-colunas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}

.painel {
  background: #162238;
  border: 2px solid #334155;
  border-radius: 14px;
  padding: 20px;
  min-width: 0;
}

.painel-topo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.painel h2,
.titulo-secao {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
}

.titulo-secao {
  margin-bottom: 14px;
}

.painel-topo a {
  color: #f59e0b;
  font-size: .85rem;
  text-decoration: none;
}

.painel-topo a:hover {
  text-decoration: underline;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.lista li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #0f1b33;
  border-radius: 10px;
}

.lista li div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lista strong {
  color: #fff;
  font-size: .95rem;
}

.lista small {
  color: #94a3b8;
  font-size: .8rem;
}

.tudo-certo {
  margin: 0;
  padding: 14px;
  text-align: center;
  color: #86efac;
  background: rgba(34, 197, 94, .08);
  border-radius: 10px;
  font-size: .92rem;
}

.selo {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 700;
  white-space: nowrap;
}

.selo.ruim {
  background: rgba(239, 68, 68, .18);
  color: #fca5a5;
}

.selo.aviso {
  background: rgba(245, 158, 11, .18);
  color: #fcd34d;
}

.selo.entrada {
  background: rgba(34, 197, 94, .18);
  color: #86efac;
}

.selo.saida {
  background: rgba(239, 68, 68, .18);
  color: #fca5a5;
}

/* tabela */
.tabela-area {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 10px 12px;
  font-size: .9rem;
}

th {
  color: #94a3b8;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  white-space: nowrap;
}

td {
  color: #e5e7eb;
}

tr+tr td {
  border-top: 1px solid #1e2f4d;
}

/* atalhos */
.atalhos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.atalho {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 18px;
  text-decoration: none;
  background: #162238;
  border: 2px solid #334155;
  border-radius: 12px;
  transition: border-color .15s, transform .1s;
}

.atalho strong {
  color: #f59e0b;
  font-size: 1rem;
}

.atalho span {
  color: #cbd5e1;
  font-size: .85rem;
}

.atalho:hover {
  border-color: #f59e0b;
  transform: translateY(-2px);
}
</style>