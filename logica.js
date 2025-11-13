// logica.js - Versão com Ligas Dinâmicas e Expandidas

const API_KEY = '123'; // Chave gratuita
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const SEASON = '2024-2025'; // Época atual

// --- CONFIGURAÇÃO DAS LIGAS ---
// Aqui adicionamos ou removemos ligas conforme necessário.
// IDs obtidos da TheSportsDB.
const configLigas = {
    'football': [
        { id: '4344', nome: 'Liga Portugal' },
        { id: '4328', nome: 'Premier League (Inglaterra)' },
        { id: '4335', nome: 'La Liga (Espanha)' },
        { id: '4332', nome: 'Serie A (Itália)' },
        { id: '4331', nome: 'Bundesliga (Alemanha)' },
        { id: '4480', nome: 'UEFA Champions League' }
    ],
    'basketball': [
        { id: '4387', nome: 'NBA' },
        { id: '4546', nome: 'EuroLeague' },
        { id: '4388', nome: 'NBA G League' } // Exemplo adicional
    ],
    'volleyball': [
        { id: '5616', nome: 'CEV Champions League' }
    ]
};

// Mapeamento de nomes para a API (strSport)
const sportMap = {
    'football': 'Soccer',
    'basketball': 'Basketball',
    'volleyball': 'Volleyball'
};

// Estado da aplicação
let paginaAtual = 1;
let eventosPorPagina = 12;
let todosEventos = [];
let eventosFiltrados = [];

// --- FUNÇÕES AUXILIARES ---

function formatarData(dateStr) {
    if (!dateStr) return { day: '--', month: '--' };
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const month = months[date.getMonth()];
    return { day, month };
}

function formatarHora(timeStr) {
    if (!timeStr) return 'A definir';
    return timeStr.substring(0, 5);
}

function obterIconeDesporto(sportName) {
    // Normaliza para minúsculas para comparar
    const s = (sportName || '').toLowerCase();
    if (s.includes('soccer') || s.includes('football')) return 'fa-futbol';
    if (s.includes('basketball') || s.includes('nba')) return 'fa-basketball-ball';
    if (s.includes('volleyball')) return 'fa-volleyball-ball';
    return 'fa-calendar-alt';
}

// --- LÓGICA DE INTERFACE (UI) ---

// Função que preenche o Dropdown de Ligas com base no Desporto selecionado
function atualizarDropdownLigas() {
    const selectDesporto = document.getElementById('desporto');
    const selectLiga = document.getElementById('liga');
    const desportoSelecionado = selectDesporto.value;

    // Limpar opções atuais (mantendo apenas a opção "Todas")
    selectLiga.innerHTML = '<option value="all">Todas as Ligas</option>';

    if (desportoSelecionado === 'all') {
        // Se "Todos os Desportos", podemos mostrar TODAS as ligas misturadas ou deixar vazio
        // Aqui vou adicionar todas agrupadas para facilitar
        Object.keys(configLigas).forEach(sport => {
            configLigas[sport].forEach(liga => {
                const option = document.createElement('option');
                option.value = liga.id;
                option.textContent = liga.nome;
                selectLiga.appendChild(option);
            });
        });
    } else {
        // Adiciona apenas as ligas do desporto selecionado
        const ligas = configLigas[desportoSelecionado];
        if (ligas) {
            ligas.forEach(liga => {
                const option = document.createElement('option');
                option.value = liga.id;
                option.textContent = liga.nome;
                selectLiga.appendChild(option);
            });
        }
    }
}

// --- LÓGICA DE DADOS (API) ---

async function buscarEventosPorEpoca(leagueId) {
    try {
        const response = await fetch(`${BASE_URL}/${API_KEY}/eventsseason.php?id=${leagueId}&s=${SEASON}`);
        const data = await response.json();
        return data.events || [];
    } catch (error) {
        console.error(`Erro liga ${leagueId}:`, error);
        return [];
    }
}

async function buscarTodosEventos() {
    const events = [];
    // Reunir todos os IDs de todas as ligas configuradas
    let todosIDs = [];
    Object.values(configLigas).forEach(lista => {
        lista.forEach(item => todosIDs.push(item.id));
    });

    // Nota: A API Grátis pode bloquear se fizermos 20 pedidos ao mesmo tempo. 
    const promises = todosIDs.map(id => buscarEventosPorEpoca(id));
    const results = await Promise.all(promises);
    
    results.forEach(leagueEvents => {
        if(leagueEvents) events.push(...leagueEvents);
    });
    
    // Remover duplicados
    const uniqueEvents = Array.from(new Map(events.map(e => [e.idEvent, e])).values());

    // Ordenar: Mais recentes/futuros primeiro
    return uniqueEvents.sort((a, b) => {
        return new Date(a.dateEvent + 'T' + (a.strTime || '00:00')) - new Date(b.dateEvent + 'T' + (b.strTime || '00:00'));
    });
}

function criarCartaoEvento(event, viewType = 'list') {
    const { day, month } = formatarData(event.dateEvent);
    const time = formatarHora(event.strTime);
    const sportIcon = obterIconeDesporto(event.strSport);
    const temResultado = event.intHomeScore !== null && event.intAwayScore !== null;
    
    let linkResultado = '';
    if (temResultado) {
        linkResultado = `
            <a href="resultados.html?id=${event.idEvent}" class="link-resultado" title="Ver Resultado">
                <i class="fas fa-chevron-right"></i>
            </a>
        `;
    }
    
    const titulo = event.strEvent || `${event.strHomeTeam} vs ${event.strAwayTeam}`;

    if (viewType === 'list') {
        return `
            <div class="cartao-evento">
                <div class="data-evento">
                    <span class="dia">${day}</span>
                    <span class="mes">${month}</span>
                </div>
                <div class="info-evento">
                    <h3>${titulo}</h3>
                    <p><i class="fas ${sportIcon}"></i> ${event.strSport} - ${event.strLeague}</p>
                    <p><i class="far fa-clock"></i> ${time} ${event.strVenue ? '| ' + event.strVenue : ''}</p>
                </div>
                ${linkResultado} 
            </div>
        `;
    } else {
        return `
            <div class="cartao-evento-grelha">
                <div class="cabecalho-evento">
                    <span class="data-evento-pequena">${day} ${month}</span>
                    <span class="hora-evento">${time}</span>
                </div>
                <div class="corpo-evento">
                    <h3>${titulo}</h3>
                    <p><i class="fas ${sportIcon}"></i> ${event.strSport}</p>
                    <p class="liga">${event.strLeague}</p>
                </div>
                ${temResultado ? `<a href="resultados.html?id=${event.idEvent}" class="link-resultado-grelha">Ver Resultado</a>` : ''}
            </div>
        `;
    }
}

function renderizarEventos(viewType = 'list') {
    const container = document.getElementById('container-eventos');
    
    if (eventosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="sem-eventos">
                <i class="fas fa-calendar-times"></i>
                <p>Nenhum evento encontrado. Tenta limpar os filtros.</p>
            </div>
        `;
        atualizarPaginacao();
        return;
    }
    
    const start = (paginaAtual - 1) * eventosPorPagina;
    const end = start + eventosPorPagina;
    const eventsToShow = eventosFiltrados.slice(start, end);
    
    container.className = viewType === 'list' ? 'lista-eventos' : 'grelha-eventos';
    container.innerHTML = eventsToShow.map(event => criarCartaoEvento(event, viewType)).join('');
    
    atualizarPaginacao();
}

function atualizarPaginacao() {
    const totalPages = Math.ceil(eventosFiltrados.length / eventosPorPagina) || 1;
    const elPagAtual = document.getElementById('pagina-atual');
    const elPagTotal = document.getElementById('paginas-totais');
    
    if(elPagAtual) elPagAtual.textContent = paginaAtual;
    if(elPagTotal) elPagTotal.textContent = totalPages;
    
    const btnAnt = document.getElementById('pagina-anterior');
    const btnSeg = document.getElementById('pagina-seguinte');
    
    if(btnAnt) btnAnt.disabled = paginaAtual === 1;
    if(btnSeg) btnSeg.disabled = paginaAtual >= totalPages;
}

function aplicarFiltros() {
    const sport = document.getElementById('desporto').value;
    const leagueID = document.getElementById('liga').value; // Agora usamos o ID diretamente
    const date = document.getElementById('data').value;
    const team = document.getElementById('equipa').value.toLowerCase();
    
    eventosFiltrados = todosEventos.filter(event => {
        // Filtro Desporto
        if (sport !== 'all') {
            if (event.strSport !== sportMap[sport]) return false;
        }
        
        // Filtro Liga (Comparando ID)
        if (leagueID !== 'all') {
            if (event.idLeague !== leagueID) return false;
        }
        
        // Filtro Data
        if (date) {
            if (event.dateEvent !== date) return false;
        }
        
        // Filtro Equipa
        if (team) {
            const eventName = (event.strEvent || '').toLowerCase();
            const homeTeam = (event.strHomeTeam || '').toLowerCase();
            const awayTeam = (event.strAwayTeam || '').toLowerCase();
            if (!eventName.includes(team) && !homeTeam.includes(team) && !awayTeam.includes(team)) {
                return false;
            }
        }
        return true;
    });
    
    paginaAtual = 1;
    const activeBtn = document.querySelector('.botao-vista.active');
    renderizarEventos(activeBtn ? activeBtn.dataset.view : 'list');
}

function limparFiltros() {
    document.getElementById('desporto').value = 'all';
    // Atualizar dropdown para mostrar tudo de volta
    atualizarDropdownLigas();
    document.getElementById('liga').value = 'all';
    document.getElementById('data').value = '';
    document.getElementById('equipa').value = '';
    
    eventosFiltrados = [...todosEventos];
    paginaAtual = 1;
    renderizarEventos('list');
}

// Inicialização
async function initCalendario() {
    const container = document.getElementById('container-eventos');
    if (!container) return;
    
    container.innerHTML = `
        <div class="carregamento">
            <i class="fas fa-spinner fa-spin"></i>
            <p>A carregar eventos da época ${SEASON}...</p>
        </div>
    `;
    
    // 1. Preencher o dropdown de ligas inicial
    atualizarDropdownLigas();

    // 2. Buscar eventos
    todosEventos = await buscarTodosEventos();
    eventosFiltrados = [...todosEventos];
    
    renderizarEventos('list');
    
    // Listeners
    document.getElementById('aplicar-filtros').addEventListener('click', aplicarFiltros);
    document.getElementById('limpar-filtros').addEventListener('click', limparFiltros);
    
    // --- A MÁGICA ACONTECE AQUI ---
    // Quando mudar o desporto, atualiza a lista de ligas
    document.getElementById('desporto').addEventListener('change', () => {
        atualizarDropdownLigas();
    });
    
    // Paginação e Vistas
    document.getElementById('pagina-anterior').addEventListener('click', () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            const view = document.querySelector('.botao-vista.active').dataset.view;
            renderizarEventos(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    document.getElementById('pagina-seguinte').addEventListener('click', () => {
        const totalPages = Math.ceil(eventosFiltrados.length / eventosPorPagina);
        if (paginaAtual < totalPages) {
            paginaAtual++;
            const view = document.querySelector('.botao-vista.active').dataset.view;
            renderizarEventos(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    document.querySelectorAll('.botao-vista').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.botao-vista').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderizarEventos(this.dataset.view);
        });
    });
}

if (document.getElementById('container-eventos')) {
    document.addEventListener('DOMContentLoaded', initCalendario);
}