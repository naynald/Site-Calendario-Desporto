// --- CONFIGURAÇÕES INICIAIS ---
const API_KEY = '123'; // A nossa chave grátis
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const SEASON = '2025-2026'; // A época que estamos a carregar
const CACHE_KEY = 'sportcalendar_cache_v1'; // O nome da nossa cache
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Horas

// A nossa lista de ligas. Se quisermos mais, é só adicionar aqui o ID e o Nome.
const configLigas = {
    'football': [
        { id: '4344', nome: 'Liga Portugal' },
        { id: '4328', nome: 'Premier League' },
        { id: '4335', nome: 'La Liga' },
        { id: '4332', nome: 'Serie A' },
        { id: '4331', nome: 'Bundesliga' },
        { id: '4480', nome: 'Champions League' }
    ],
    'basketball': [
        { id: '4387', nome: 'NBA' },
        { id: '4546', nome: 'EuroLeague' }
    ],
    'volleyball': [
        { id: '5616', nome: 'CEV Champions League' }
    ]
};

// Mapeamento para garantir que os nomes batem certo com o filtro
const sportMap = {
    'football': 'Soccer',
    'basketball': 'Basketball',
    'volleyball': 'Volleyball'
};

// --- ESTADO DO SITE ---
// Aqui guardamos o que está a acontecer no momento
let paginaAtual = 1;
let eventosPorPagina = 12;
let todosEventos = [];    // A lista com tudo
let eventosFiltrados = []; // O que o utilizador está a ver agora

// --- SISTEMA DE CACHE ---
// Isto serve para guardar os dados no computador do utilizador.

function guardarEmCache(dados) {
    const pacote = {
        timestamp: new Date().getTime(), // Guardamos a hora para saber se está velho
        eventos: dados
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(pacote));
    console.log("Guardámos cache.");
}

function lerDoCache() {
    const dadosGuardados = localStorage.getItem(CACHE_KEY);
    if (!dadosGuardados) return null; // Não temos nada guardado

    const pacote = JSON.parse(dadosGuardados);
    const agora = new Date().getTime();

    // Se os dados tiverem menos de 24h, usamos-os
    if (agora - pacote.timestamp < CACHE_DURATION) {
        console.log("A usar dados da cache (Rápido!)");
        return pacote.eventos;
    }
    
    console.log("Os dados estão velhos. Vamos buscar novos à API.");
    return null; 
}

// --- FUNÇÕES DE AJUDA ---

function formatarData(dateStr) {
    if (!dateStr) return { day: '--', month: '--' };
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return { day, month: months[date.getMonth()] };
}

function formatarHora(timeStr) {
    if (!timeStr) return 'A definir';
    return timeStr.substring(0, 5); // Cortamos os segundos
}

function obterIconeDesporto(sportName) {
    const s = (sportName || '').toLowerCase();
    if (s.includes('soccer') || s.includes('football')) return 'fa-futbol';
    if (s.includes('basketball') || s.includes('nba')) return 'fa-basketball-ball';
    if (s.includes('volleyball')) return 'fa-volleyball-ball';
    return 'fa-calendar-alt';
}

// --- FUNÇÃO DE ORDENAÇÃO ---
// Criámos esta função para garantir que a ordem é SEMPRE a mesma:
// Jogos perto de "HOJE" aparecem primeiro (seja ontem ou amanhã).
function ordenarPorProximidade(lista) {
    const hoje = new Date();
    hoje.setHours(0,0,0,0); // Reset às horas para comparar apenas dias

    return lista.sort((a, b) => {
        const dA = new Date(a.dateEvent + 'T' + (a.strTime || '00:00'));
        const dB = new Date(b.dateEvent + 'T' + (b.strTime || '00:00'));
        
        // Distância absoluta até hoje
        const diffA = Math.abs(dA - hoje);
        const diffB = Math.abs(dB - hoje);
        
        // Quem estiver mais perto ganha prioridade na lista
        if (diffA !== diffB) return diffA - diffB;
        
        // Desempate: O futuro aparece antes do passado
        return dA - dB;
    });
}

// --- INTERFACE: DROPDOWN ---
function atualizarDropdownLigas() {
    const selectDesporto = document.getElementById('desporto');
    const selectLiga = document.getElementById('liga');
    if (!selectDesporto || !selectLiga) return;

    const desportoSelecionado = selectDesporto.value;
    selectLiga.innerHTML = '<option value="all">Todas as Ligas</option>';

    // Lógica: Se escolher "Todos", mete todas as ligas. Se escolher um desporto, filtra.
    if (desportoSelecionado === 'all') {
        Object.keys(configLigas).forEach(sport => {
            configLigas[sport].forEach(liga => {
                const opt = document.createElement('option');
                opt.value = liga.id;
                opt.textContent = liga.nome;
                selectLiga.appendChild(opt);
            });
        });
    } else {
        configLigas[desportoSelecionado].forEach(liga => {
            const opt = document.createElement('option');
            opt.value = liga.id;
            opt.textContent = liga.nome;
            selectLiga.appendChild(opt);
        });
    }
}

// --- O CORAÇÃO DA API ---

async function buscarEventosPorEpoca(leagueId) {
    try {
        const response = await fetch(`${BASE_URL}/${API_KEY}/eventsseason.php?id=${leagueId}&s=${SEASON}`);
        const data = await response.json();
        return data.events || [];
    } catch (error) { return []; }
}

async function buscarTodosEventos() {
    // 1. Primeiro, espreitamos a Cache.
    const dadosCache = lerDoCache();
    if (dadosCache) {
        return dadosCache; 
    }

    // 2. Se não houver cache, temos de ir buscar tudo.
    const events = [];
    let todasLigas = [];
    Object.values(configLigas).forEach(lista => lista.forEach(l => todasLigas.push(l)));
    
    const statusLoading = document.querySelector('.carregamento p');

    // Vamos percorrer liga a liga com pausas para não bloquear
    for (const [index, liga] of todasLigas.entries()) {
        if(statusLoading) statusLoading.textContent = `A carregar ${liga.nome} (${index + 1}/${todasLigas.length})...`;
        
        try {
            const leagueEvents = await buscarEventosPorEpoca(liga.id);
            if (leagueEvents) events.push(...leagueEvents);
            
            // Esperamos 1.5 segundos entre cada pedido!
            await new Promise(r => setTimeout(r, 1500)); 

        } catch (err) {
            console.warn(`Oops, falhou a liga ${liga.nome}`);
        }
    }

    // 3. Limpeza
    const uniqueEvents = Array.from(new Map(events.map(e => [e.idEvent, e])).values());
    
    // 4. ORDENAÇÃO INTELIGENTE (Usamos a função nova)
    const ordenados = ordenarPorProximidade(uniqueEvents);

    // 5. Guardamos o trabalho feito na Cache
    guardarEmCache(ordenados);
    
    return ordenados;
}

// --- CRIAR OS CARTÕES (O Visual) ---

function criarCartaoEvento(event, viewType = 'list') {
    const { day, month } = formatarData(event.dateEvent);
    const time = formatarHora(event.strTime);
    const sportIcon = obterIconeDesporto(event.strSport);
    
    const temRes = event.intHomeScore !== null && event.intAwayScore !== null;
    const titulo = event.strEvent || `${event.strHomeTeam} vs ${event.strAwayTeam}`;

    let link = temRes ? `<a href="resultados.html?id=${event.idEvent}" class="link-resultado"><i class="fas fa-chevron-right"></i></a>` : '';

    if (viewType === 'list') {
        return `
            <div class="cartao-evento">
                <div class="data-evento"><span class="dia">${day}</span><span class="mes">${month}</span></div>
                <div class="info-evento">
                    <h3>${titulo}</h3>
                    <p><i class="fas ${sportIcon}"></i> ${event.strSport} - ${event.strLeague}</p>
                    <p><i class="far fa-clock"></i> ${time}</p>
                </div>
                ${link}
            </div>`;
    } else {
        return `
            <div class="cartao-evento-grelha">
                <div class="cabecalho-evento"><span>${day} ${month}</span><span>${time}</span></div>
                <div class="corpo-evento">
                    <h3>${titulo}</h3>
                    <p><i class="fas ${sportIcon}"></i> ${event.strSport}</p>
                    <p class="liga">${event.strLeague}</p>
                </div>
                ${temRes ? `<a href="resultados.html?id=${event.idEvent}" class="link-resultado-grelha">Ver Resultado</a>` : ''}
            </div>`;
    }
}

// --- RENDERIZAR NO ECRÃ ---

function renderizarEventos(viewType = 'list') {
    const container = document.getElementById('container-eventos');
    if (!container) return;
    
    if (eventosFiltrados.length === 0) {
        container.innerHTML = `<div class="sem-eventos"><i class="fas fa-calendar-times"></i><p>Nada para mostrar aqui.</p></div>`;
        atualizarPaginacao();
        return;
    }
    
    const start = (paginaAtual - 1) * eventosPorPagina;
    const end = start + eventosPorPagina;
    
    container.className = viewType === 'list' ? 'lista-eventos' : 'grelha-eventos';
    container.innerHTML = eventosFiltrados.slice(start, end).map(e => criarCartaoEvento(e, viewType)).join('');
    
    atualizarPaginacao();
}

function atualizarPaginacao() {
    const total = Math.ceil(eventosFiltrados.length / eventosPorPagina) || 1;
    
    const elPag = document.getElementById('pagina-atual');
    const elTot = document.getElementById('paginas-totais');
    if(elPag) elPag.textContent = paginaAtual;
    if(elTot) elTot.textContent = total;
    
    const btnAnt = document.getElementById('pagina-anterior');
    const btnSeg = document.getElementById('pagina-seguinte');
    if(btnAnt) btnAnt.disabled = paginaAtual === 1;
    if(btnSeg) btnSeg.disabled = paginaAtual >= total;
}

// --- FILTROS ---

function aplicarFiltros() {
    // Vamos buscar o que o utilizador escolheu
    const sport = document.getElementById('desporto').value;
    const lg = document.getElementById('liga').value;
    const dt = document.getElementById('data').value;
    const tm = document.getElementById('equipa').value.toLowerCase();
    
    // 1. Filtramos a lista principal
    let tempEventos = todosEventos.filter(e => {
        if (sport !== 'all' && e.strSport !== sportMap[sport]) return false;
        if (lg !== 'all' && e.idLeague !== lg) return false;
        if (dt && e.dateEvent !== dt) return false;
        if (tm && !(e.strEvent+e.strHomeTeam+e.strAwayTeam).toLowerCase().includes(tm)) return false;
        return true;
    });
    
    // 2. Reordenamos a lista filtrada
    // Assim, mesmo depois de filtrar, o foco continua no "Hoje".
    eventosFiltrados = ordenarPorProximidade(tempEventos);
    
    // Resetamos a página para 1 e desenhamos
    paginaAtual = 1;
    const view = document.querySelector('.botao-vista.active') ? document.querySelector('.botao-vista.active').dataset.view : 'list';
    renderizarEventos(view);
}

function limparFiltros() {
    // Reseta tudo para o estado inicial
    document.getElementById('desporto').value = 'all';
    atualizarDropdownLigas();
    document.getElementById('liga').value = 'all';
    document.getElementById('data').value = '';
    document.getElementById('equipa').value = '';
    
    // Restaura a lista completa (que já está ordenada)
    eventosFiltrados = [...todosEventos];
    paginaAtual = 1;
    renderizarEventos('list');
}

// --- ARRANQUE ---

async function initCalendario() {
    const container = document.getElementById('container-eventos');
    container.innerHTML = `<div class="carregamento"><i class="fas fa-spinner fa-spin"></i><p>A atualizar base de dados (pode demorar 1 min na primeira vez)...</p></div>`;
    
    atualizarDropdownLigas();
    todosEventos = await buscarTodosEventos();
    eventosFiltrados = [...todosEventos];
    renderizarEventos('list');
    
    // Ligar os botões às funções
    document.getElementById('aplicar-filtros').addEventListener('click', aplicarFiltros);
    document.getElementById('limpar-filtros').addEventListener('click', limparFiltros);
    document.getElementById('desporto').addEventListener('change', atualizarDropdownLigas);
    
    // Navegação
    document.getElementById('pagina-anterior').addEventListener('click', () => { if(paginaAtual>1){ paginaAtual--; renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); window.scrollTo({top:0,behavior:'smooth'});}});
    document.getElementById('pagina-seguinte').addEventListener('click', () => { const t=Math.ceil(eventosFiltrados.length/eventosPorPagina); if(paginaAtual<t){ paginaAtual++; renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); window.scrollTo({top:0,behavior:'smooth'});}});
    
    // Troca de vistas
    document.querySelectorAll('.botao-vista').forEach(b => b.addEventListener('click', function() { document.querySelectorAll('.botao-vista').forEach(x=>x.classList.remove('active')); this.classList.add('active'); renderizarEventos(this.dataset.view); }));
}

async function initHomepage() {
    const container = document.getElementById('container-proximos-index');
    if(!container) return;
    
    // Na Home, usamos os mesmos dados inteligentes.
    let todos = await buscarTodosEventos(); 
    const top3 = todos.slice(0, 3);

    if(top3.length === 0) container.innerHTML = '<p>Sem eventos.</p>';
    else container.innerHTML = top3.map(e => criarCartaoEvento(e, 'list')).join('');
}

// O evento que dispara quando a página acaba de carregar
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('container-eventos')) initCalendario();
    if(document.getElementById('container-proximos-index')) initHomepage();
});