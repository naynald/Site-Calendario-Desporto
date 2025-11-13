// --- CONSTANTES E CONFIGURAÇÃO DA API ---
const API_KEY = '123'; // Chave gratuita para testes (limitada em algumas funcionalidades)
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const SEASON = '2024-2025'; // Define a época atual para buscar os jogos corretos

// --- CONFIGURAÇÃO DAS LIGAS (EDITÁVEL) ---
// Este objeto controla quais as ligas que aparecem no site.
// Se quisermos adicionar mais ligas, basta colocar o ID e o Nome aqui.
// O JavaScript vai ler isto e criar o menu "Select" automaticamente.
const configLigas = {
    'football': [ // Futebol
        { id: '4344', nome: 'Liga Portugal' },
        { id: '4328', nome: 'Premier League (Inglaterra)' },
        { id: '4335', nome: 'La Liga (Espanha)' },
        { id: '4332', nome: 'Serie A (Itália)' },
        { id: '4331', nome: 'Bundesliga (Alemanha)' },
        { id: '4480', nome: 'UEFA Champions League' }
    ],
    'basketball': [ // Basquetebol
        { id: '4387', nome: 'NBA' },
        { id: '4546', nome: 'EuroLeague' },
        { id: '4388', nome: 'NBA G League' }
    ],
    'volleyball': [ // Voleibol
        { id: '5083', nome: 'Nations League (Masculino)' },
        { id: '5084', nome: 'Nations League (Feminino)' },
        { id: '5616', nome: 'CEV Champions League' }
    ]
};

// Mapeamento técnico: Converte o valor do filtro para o nome usado na API
const sportMap = {
    'football': 'Soccer',
    'basketball': 'Basketball',
    'volleyball': 'Volleyball'
};

// --- ESTADO DA APLICAÇÃO ---
// Variáveis globais para guardar os dados enquanto o utilizador navega
let paginaAtual = 1;
let eventosPorPagina = 12;
let todosEventos = [];    // Lista completa vinda da API
let eventosFiltrados = []; // Lista reduzida após aplicar filtros

// --- FUNÇÕES AUXILIARES (FORMATADORES) ---

// Formata a data de "2025-10-24" para dia "24" e mês "Out"
function formatarData(dateStr) {
    if (!dateStr) return { day: '--', month: '--' };
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    // Array de meses em PT-PT
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const month = months[date.getMonth()];
    return { day, month };
}

// Corta os segundos da hora (ex: "20:00:00" vira "20:00")
function formatarHora(timeStr) {
    if (!timeStr) return 'A definir';
    return timeStr.substring(0, 5);
}

// Escolhe o ícone do FontAwesome correto baseado no desporto
function obterIconeDesporto(sportName) {
    const s = (sportName || '').toLowerCase();
    if (s.includes('soccer') || s.includes('football')) return 'fa-futbol';
    if (s.includes('basketball') || s.includes('nba')) return 'fa-basketball-ball';
    if (s.includes('volleyball')) return 'fa-volleyball-ball';
    return 'fa-calendar-alt'; // Ícone genérico caso falhe
}

// --- LÓGICA DE INTERFACE (UI) ---

// Esta função é CRUCIAL: Ela cria as opções do <select> dinamicamente.
// Evita que tenhamos de escrever HTML manualmente para cada liga nova.
function atualizarDropdownLigas() {
    const selectDesporto = document.getElementById('desporto');
    const selectLiga = document.getElementById('liga');
    
    // Proteção: Se não estivermos na página de calendário, sai da função
    if (!selectDesporto || !selectLiga) return;

    const desportoSelecionado = selectDesporto.value;

    // Reseta o menu sempre com a opção "Todas"
    selectLiga.innerHTML = '<option value="all">Todas as Ligas</option>';

    if (desportoSelecionado === 'all') {
        // Se selecionou "Todos", mostra as ligas de TODOS os desportos
        Object.keys(configLigas).forEach(sport => {
            configLigas[sport].forEach(liga => {
                const option = document.createElement('option');
                option.value = liga.id; // O valor enviado será o ID (ex: 4344)
                option.textContent = liga.nome; // O texto visível será o Nome
                selectLiga.appendChild(option);
            });
        });
    } else {
        // Se selecionou um desporto específico, mostra só essas ligas
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

// Busca os eventos de UMA liga específica para a época definida
async function buscarEventosPorEpoca(leagueId) {
    try {
        const response = await fetch(`${BASE_URL}/${API_KEY}/eventsseason.php?id=${leagueId}&s=${SEASON}`);
        const data = await response.json();
        return data.events || [];
    } catch (error) {
        console.error(`Erro ao carregar a liga ID ${leagueId}:`, error);
        return []; // Retorna array vazio em caso de erro para não quebrar o site
    }
}

// Função principal que percorre TODAS as ligas configuradas e junta tudo
async function buscarTodosEventos() {
    const events = [];
    let todosIDs = [];
    
    // 1. Recolhe todos os IDs de ligas do nosso ficheiro de configuração
    Object.values(configLigas).forEach(lista => {
        lista.forEach(item => todosIDs.push(item.id));
    });

    // 2. Faz os pedidos à API em PARALELO (muito mais rápido que um a um)
    const promises = todosIDs.map(id => buscarEventosPorEpoca(id));
    const results = await Promise.all(promises);
    
    // 3. Junta os resultados de todas as ligas num único array
    results.forEach(leagueEvents => {
        if(leagueEvents) events.push(...leagueEvents);
    });
    
    // 4. Remove duplicados (segurança extra)
    const uniqueEvents = Array.from(new Map(events.map(e => [e.idEvent, e])).values());
    
    // 5. Ordena por Data (Futuros e Recentes misturados cronologicamente)
    return uniqueEvents.sort((a, b) => {
        const dataA = new Date(a.dateEvent + 'T' + (a.strTime || '00:00'));
        const dataB = new Date(b.dateEvent + 'T' + (b.strTime || '00:00'));
        return dataA - dataB; // Ascendente (mais antigo para mais recente)
    });
}

// --- COMPONENTES HTML (CARDS) ---

// Gera o HTML de um cartão individual (usado tanto na Lista como na Home)
function criarCartaoEvento(event, viewType = 'list') {
    const { day, month } = formatarData(event.dateEvent);
    const time = formatarHora(event.strTime);
    const sportIcon = obterIconeDesporto(event.strSport);
    
    // Verifica se o jogo já tem resultado (pontuação existe)
    const temResultado = event.intHomeScore !== null && event.intAwayScore !== null;
    
    // Lógica da Seta/Botão de Resultado
    let linkResultado = '';
    if (temResultado) {
        linkResultado = `
            <a href="resultados.html?id=${event.idEvent}" class="link-resultado" title="Ver Resultado">
                <i class="fas fa-chevron-right"></i>
            </a>
        `;
    }
    
    // Cria título seguro (caso API falhe o nome do evento)
    const titulo = event.strEvent || `${event.strHomeTeam} vs ${event.strAwayTeam}`;

    // Template Vista Lista
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
    } 
    // Template Vista Grelha
    else {
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

// --- FUNÇÕES ESPECÍFICAS: PÁGINA CALENDÁRIO ---

// Renderiza a lista de eventos no ecrã, respeitando a paginação
function renderizarEventos(viewType = 'list') {
    const container = document.getElementById('container-eventos');
    if (!container) return;
    
    // Se não houver eventos após o filtro
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
    
    // Cálculos de paginação
    const start = (paginaAtual - 1) * eventosPorPagina;
    const end = start + eventosPorPagina;
    const eventsToShow = eventosFiltrados.slice(start, end);
    
    // Define classe para CSS (lista ou grelha)
    container.className = viewType === 'list' ? 'lista-eventos' : 'grelha-eventos';
    
    // Injeta o HTML
    container.innerHTML = eventsToShow.map(event => criarCartaoEvento(event, viewType)).join('');
    
    atualizarPaginacao();
}

// Atualiza os números e botões da paginação
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

// Aplica os filtros selecionados pelo utilizador
function aplicarFiltros() {
    const sport = document.getElementById('desporto').value;
    const leagueID = document.getElementById('liga').value;
    const date = document.getElementById('data').value;
    const team = document.getElementById('equipa').value.toLowerCase();
    
    // Filtra o array principal (todosEventos)
    eventosFiltrados = todosEventos.filter(event => {
        if (sport !== 'all' && event.strSport !== sportMap[sport]) return false;
        if (leagueID !== 'all' && event.idLeague !== leagueID) return false;
        if (date && event.dateEvent !== date) return false;
        
        if (team) {
            const eventName = (event.strEvent || '').toLowerCase();
            const homeTeam = (event.strHomeTeam || '').toLowerCase();
            const awayTeam = (event.strAwayTeam || '').toLowerCase();
            // Verifica se o nome pesquisado existe no evento ou nas equipas
            if (!eventName.includes(team) && !homeTeam.includes(team) && !awayTeam.includes(team)) {
                return false;
            }
        }
        return true;
    });
    
    // Volta à página 1 sempre que se filtra
    paginaAtual = 1;
    
    // Mantém a vista atual (lista ou grelha)
    const activeBtn = document.querySelector('.botao-vista.active');
    renderizarEventos(activeBtn ? activeBtn.dataset.view : 'list');
}

// Limpa tudo e restaura os dados originais
function limparFiltros() {
    document.getElementById('desporto').value = 'all';
    atualizarDropdownLigas(); // Reconstrói o dropdown completo
    document.getElementById('liga').value = 'all';
    document.getElementById('data').value = '';
    document.getElementById('equipa').value = '';
    
    eventosFiltrados = [...todosEventos];
    paginaAtual = 1;
    renderizarEventos('list');
}

// --- INICIALIZADORES (PONTO DE ENTRADA) ---

// 1. Inicializador da Página CALENDÁRIO
async function initCalendario() {
// 1. Estado Inicial: Mostra o ícone de "Loading" enquanto os dados não chegam
    const container = document.getElementById('container-eventos');
    container.innerHTML = `<div class="carregamento"><i class="fas fa-spinner fa-spin"></i><p>A carregar eventos da época ${SEASON}...</p></div>`;
    
    // 2. Inicialização dos Dados
    atualizarDropdownLigas(); // Preenche o <select> das ligas pela primeira vez
    todosEventos = await buscarTodosEventos(); // Vai à API buscar TUDO (pode demorar uns segundos)
    eventosFiltrados = [...todosEventos]; // Inicialmente, a lista filtrada é igual à lista completa
    renderizarEventos('list'); // Desenha os cartões no ecrã (vista de lista por defeito)
    
    // 3. Configuração dos Botões de Filtro
    // Botão "Aplicar Filtros": Executa a filtragem baseada nas escolhas do utilizador
    document.getElementById('aplicar-filtros').addEventListener('click', aplicarFiltros);
    
    // Botão "Limpar Filtros": Reseta tudo para o estado original
    document.getElementById('limpar-filtros').addEventListener('click', limparFiltros);
    
    // Dropdown Dinâmico: Quando mudas o Desporto, as Ligas atualizam automaticamente
    document.getElementById('desporto').addEventListener('change', atualizarDropdownLigas);
    
    // 4. Configuração da Navegação (Paginação)
    // Botão "Anterior": Só funciona se não estivermos na página 1
    document.getElementById('pagina-anterior').addEventListener('click', () => {
        if (paginaAtual > 1) { 
            paginaAtual--; 
            // Mantém a vista atual (lista ou grelha) ao mudar de página
            renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); 
            window.scrollTo({top:0, behavior:'smooth'}); // Volta ao topo da página suavemente
        }
    });

    // Botão "Seguinte": Só funciona se não estivermos na última página
    document.getElementById('pagina-seguinte').addEventListener('click', () => {
        const total = Math.ceil(eventosFiltrados.length / eventosPorPagina); // Calcula total de páginas
        if (paginaAtual < total) { 
            paginaAtual++; 
            renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); 
            window.scrollTo({top:0, behavior:'smooth'}); 
        }
    });

    // 5. Configuração da Vista (Lista vs Grelha)
    // Adiciona o clique aos dois botões de vista
    document.querySelectorAll('.botao-vista').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove a classe 'active' de todos os botões
            document.querySelectorAll('.botao-vista').forEach(b => b.classList.remove('active'));
            // Adiciona 'active' apenas ao botão clicado
            this.classList.add('active');
            // Redesenha os eventos com o novo formato ('list' ou 'grid')
            renderizarEventos(this.dataset.view);
        });
    });
}
// 2. Inicializador da Página INICIAL (INDEX)
async function initHomepage() {
const container = document.getElementById('container-proximos-index');
    if (!container) return;

    try {
        // TRUQUE: Para a Home, carregamos APENAS 2 ligas principais para não bloquear a API
        // Se tentarmos carregar todas, a API bloqueia e o site fica a carregar infinitamente.
        const idsDestaque = [
            '4328', // Premier League
            '4387'  // NBA
        ];

        const promises = idsDestaque.map(id => buscarProximosDaLiga(id));
        const results = await Promise.all(promises);
        
        let futuros = [];
        results.forEach(leagueEvents => { if(leagueEvents) futuros.push(...leagueEvents); });

        // Ordenar por data (Próximos primeiro)
        futuros.sort((a, b) => {
            const dataA = new Date(a.dateEvent + 'T' + (a.strTime || '00:00'));
            const dataB = new Date(b.dateEvent + 'T' + (b.strTime || '00:00'));
            return dataA - dataB;
        });

        // Pegar Top 3
        const top3 = futuros.slice(0, 3);

        if (top3.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#666;">Não há eventos próximos agendados nas ligas em destaque.</p>';
        } else {
            container.innerHTML = top3.map(evento => criarCartaoEvento(evento, 'list')).join('');
        }
    } catch (erro) {
        // Se der erro, remove o loading e mostra mensagem
        container.innerHTML = '<p style="text-align:center;">Não foi possível carregar os eventos de destaque.</p>';
        console.error(erro);
    }
}

// --- ARRANQUE GLOBAL DA APLICAÇÃO ---
// Este código corre assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
    // Roteamento Simples:
    // Verifica se existe um elemento específico para saber em que página estamos
if (document.getElementById('container-eventos')) initCalendario();
if (document.getElementById('container-proximos-index')) initHomepage();
});