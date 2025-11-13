// logica.js - Versão Final (Ordenação Inteligente + Modo de Segurança)

// --- CONSTANTES E CONFIGURAÇÃO DA API ---
const API_KEY = '123'; // Chave gratuita para testes (limitada em algumas funcionalidades)
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const SEASON = '2025-2026'; // Define a época atual para buscar os jogos corretos

// --- CONFIGURAÇÃO DAS LIGAS (EDITÁVEL) ---
// Este objeto controla quais as ligas que aparecem no site.
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
                option.value = liga.id;
                option.textContent = liga.nome;
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
        return [];
    }
}

// Busca PRÓXIMOS jogos (Usado na Home para evitar bloqueios)
async function buscarProximosDaLiga(leagueId) {
    try {
        // Timeout de 3 segundos para não prender a página se a API estiver lenta
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${BASE_URL}/${API_KEY}/eventsnextleague.php?id=${leagueId}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        return data.events || [];
    } catch (error) {
        return []; // Falha silenciosa
    }
}

// Função principal que percorre TODAS as ligas e ORGANIZA (Futuros primeiro)
async function buscarTodosEventos() {
    const events = [];
    let todosIDs = [];
    
    // 1. Recolhe todos os IDs
    Object.values(configLigas).forEach(lista => {
        lista.forEach(item => todosIDs.push(item.id));
    });

    // 2. Faz os pedidos em PARALELO
    const promises = todosIDs.map(id => buscarEventosPorEpoca(id));
    const results = await Promise.all(promises);
    
    results.forEach(leagueEvents => {
        if(leagueEvents) events.push(...leagueEvents);
    });
    
    // 3. Remove duplicados
    const uniqueEvents = Array.from(new Map(events.map(e => [e.idEvent, e])).values());
    
    // --- NOVA LÓGICA DE ORDENAÇÃO (FUTUROS PRIMEIRO) ---
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Reset às horas para comparar apenas datas

    const passados = [];
    const futuros = [];

    uniqueEvents.forEach(event => {
        const dataEvento = new Date(event.dateEvent + 'T' + (event.strTime || '00:00'));
        
        if (dataEvento >= hoje) {
            futuros.push(event);
        } else {
            passados.push(event);
        }
    });

    // Ordena Futuros: Do mais próximo para o mais distante (Ascendente)
    futuros.sort((a, b) => {
        return new Date(a.dateEvent + 'T' + (a.strTime || '00:00')) - new Date(b.dateEvent + 'T' + (b.strTime || '00:00'));
    });

    // Ordena Passados: Do mais recente para o mais antigo (Descendente)
    passados.sort((a, b) => {
        return new Date(b.dateEvent + 'T' + (b.strTime || '00:00')) - new Date(a.dateEvent + 'T' + (a.strTime || '00:00'));
    });

    // Junta tudo: Futuros no topo, Passados no fundo
    return [...futuros, ...passados];
}

// --- COMPONENTES HTML (CARDS) ---

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

// --- FUNÇÕES ESPECÍFICAS: PÁGINA CALENDÁRIO ---

// Renderiza a lista de eventos no ecrã, respeitando a paginação e o tipo de vista (Lista ou Grelha)
function renderizarEventos(viewType = 'list') {
    // 1. Obtém o contentor onde os cartões serão inseridos
    const container = document.getElementById('container-eventos');
    
    // Segurança: Se o contentor não existir (ex: estamos noutra página), pára a execução
    if (!container) return;
    
    // 2. Verificação de "Sem Resultados"
    // Se o array de eventos filtrados estiver vazio, mostra uma mensagem amigável ao utilizador
    if (eventosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="sem-eventos">
                <i class="fas fa-calendar-times"></i>
                <p>Nenhum evento encontrado. Tenta limpar os filtros.</p>
            </div>
        `;
        // Atualiza a paginação (para esconder/desativar botões quando não há dados)
        atualizarPaginacao();
        return;
    }
    
    // 3. Cálculos de Paginação
    // Define onde começa e acaba a "fatia" de eventos a mostrar na página atual
    const start = (paginaAtual - 1) * eventosPorPagina;
    const end = start + eventosPorPagina;
    
    // Cria um sub-array apenas com os eventos desta página
    const eventsToShow = eventosFiltrados.slice(start, end);
    
    // 4. Configuração Visual
    // Alterna a classe CSS do contentor dependendo se a vista é 'list' ou 'grid'
    container.className = viewType === 'list' ? 'lista-eventos' : 'grelha-eventos';
    
    // 5. Injeção de HTML
    // Para cada evento na página atual, cria o cartão HTML e junta tudo numa string
    container.innerHTML = eventsToShow.map(event => criarCartaoEvento(event, viewType)).join('');
    
    // 6. Atualiza os controlos de paginação (números e botões Anterior/Seguinte)
    atualizarPaginacao();
}

// Atualiza os números e o estado dos botões da paginação (Anterior/Seguinte)
function atualizarPaginacao() {
    // 1. Calcula o número total de páginas necessárias
    // Divide o total de eventos filtrados pelo número de eventos por página (12)
    // O Math.ceil arredonda para cima (ex: 13 eventos / 12 = 1.08 -> 2 páginas)
    // O '|| 1' garante que temos pelo menos 1 página, mesmo sem resultados
    const totalPages = Math.ceil(eventosFiltrados.length / eventosPorPagina) || 1;
    
    // 2. Busca os elementos de texto no HTML (onde mostra "Página 1 de X")
    const elPagAtual = document.getElementById('pagina-atual');
    const elPagTotal = document.getElementById('paginas-totais');
    
    // 3. Atualiza o texto na interface (se os elementos existirem)
    if(elPagAtual) elPagAtual.textContent = paginaAtual; // Mostra a página onde estamos
    if(elPagTotal) elPagTotal.textContent = totalPages;  // Mostra o total de páginas
    
    // 4. Busca os botões de navegação
    const btnAnt = document.getElementById('pagina-anterior');
    const btnSeg = document.getElementById('pagina-seguinte');
    
    // 5. Controla se os botões podem ser clicados ou não (disabled)
    
    // Desativa o botão "Anterior" se estivermos na página 1 (não dá para voltar atrás)
    if(btnAnt) btnAnt.disabled = paginaAtual === 1;
    
    // Desativa o botão "Seguinte" se já estivermos na última página ou além dela
    if(btnSeg) btnSeg.disabled = paginaAtual >= totalPages;
}

// --- FILTROS E INTERATIVIDADE ---

// Função acionada pelo botão "Aplicar Filtros"
// Lê os valores dos inputs e filtra a lista de eventos
function aplicarFiltros() {
    // 1. Captura os valores escolhidos pelo utilizador
    const sport = document.getElementById('desporto').value;
    const leagueID = document.getElementById('liga').value;
    const date = document.getElementById('data').value;
    const team = document.getElementById('equipa').value.toLowerCase(); // Converte para minúsculas para facilitar a busca
    
    // 2. Filtra o array principal (todosEventos)
    eventosFiltrados = todosEventos.filter(event => {
        // Filtro por Desporto: Se não for "todos", verifica se corresponde ao mapa
        if (sport !== 'all' && event.strSport !== sportMap[sport]) return false;
        
        // Filtro por Liga: Compara o ID da liga
        if (leagueID !== 'all' && event.idLeague !== leagueID) return false;
        
        // Filtro por Data: Compara a data exata (YYYY-MM-DD)
        if (date && event.dateEvent !== date) return false;
        
        // Filtro por Nome da Equipa:
        if (team) {
            // Junta o nome do evento e das equipas numa só string para procurar em tudo
            const txt = (event.strEvent + event.strHomeTeam + event.strAwayTeam).toLowerCase();
            // Se o texto pesquisado não estiver nesta string combinada, exclui o evento
            if (!txt.includes(team)) return false;
        }
        
        // Se passar todas as verificações, mantém o evento na lista
        return true;
    });
    
    // 3. Reseta a navegação
    paginaAtual = 1; // Volta sempre à primeira página após filtrar
    
    // 4. Redesenha a lista mantendo a vista atual (Lista ou Grelha)
    const activeBtn = document.querySelector('.botao-vista.active');
    renderizarEventos(activeBtn ? activeBtn.dataset.view : 'list');
}

// Função acionada pelo botão "Limpar Filtros"
// Restaura o estado original da aplicação
function limparFiltros() {
    // 1. Limpa os valores visuais dos inputs
    document.getElementById('desporto').value = 'all';
    atualizarDropdownLigas(); // Importante: Reconstrói o dropdown com todas as ligas
    document.getElementById('liga').value = 'all';
    document.getElementById('data').value = '';
    document.getElementById('equipa').value = '';
    
    // 2. Restaura a lista de dados completa (cópia do original)
    eventosFiltrados = [...todosEventos];
    
    // 3. Reseta paginação e vista
    paginaAtual = 1;
    renderizarEventos('list'); // Por defeito, volta à vista de lista
}

// --- INICIALIZADORES (PONTO DE ENTRADA) ---

// 1. Inicializador da Página CALENDÁRIO
// Esta função corre apenas quando estamos na página calendario.html
async function initCalendario() {
    const container = document.getElementById('container-eventos');
    
    // A. Estado Inicial: Mostra o ícone de "Loading" enquanto os dados não chegam
    container.innerHTML = `<div class="carregamento"><i class="fas fa-spinner fa-spin"></i><p>A carregar eventos da época ${SEASON}...</p></div>`;
    
    try {
        // B. Inicialização dos Dados
        atualizarDropdownLigas(); // Preenche o <select> das ligas pela primeira vez
        todosEventos = await buscarTodosEventos(); // Vai à API buscar TUDO (pode demorar uns segundos)
        eventosFiltrados = [...todosEventos]; // Inicialmente, a lista filtrada é igual à lista completa
        renderizarEventos('list'); // Desenha os cartões no ecrã (vista de lista por defeito)
    } catch (error) {
        // Se a API falhar, mostra mensagem de erro
        container.innerHTML = `<div class="sem-eventos"><p>Erro na API. Tenta recarregar a página.</p></div>`;
    }
    
    // C. Configuração dos Event Listeners (Botões)
    document.getElementById('aplicar-filtros').addEventListener('click', aplicarFiltros);
    document.getElementById('limpar-filtros').addEventListener('click', limparFiltros);
    // Dropdown Dinâmico: Quando mudas o Desporto, as Ligas atualizam automaticamente
    document.getElementById('desporto').addEventListener('change', atualizarDropdownLigas);
    
    // D. Configuração da Navegação (Paginação)
    
    // Botão "Anterior"
    document.getElementById('pagina-anterior').addEventListener('click', () => {
        if (paginaAtual > 1) { 
            paginaAtual--; 
            // Renderiza mantendo a vista ativa e faz scroll suave para o topo
            renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); 
            window.scrollTo({top:0, behavior:'smooth'}); 
        }
    });

    // Botão "Seguinte"
    document.getElementById('pagina-seguinte').addEventListener('click', () => {
        const total = Math.ceil(eventosFiltrados.length / eventosPorPagina); 
        if (paginaAtual < total) { 
            paginaAtual++; 
            renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); 
            window.scrollTo({top:0, behavior:'smooth'}); 
        }
    });

    // E. Configuração da Troca de Vista (Lista vs Grelha)
    document.querySelectorAll('.botao-vista').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove a classe 'active' de todos e adiciona apenas ao clicado
            document.querySelectorAll('.botao-vista').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Redesenha usando o tipo de vista guardado no atributo data-view
            renderizarEventos(this.dataset.view);
        });
    });
}

// 2. Inicializador da Página INICIAL (INDEX)
async function initHomepage() {
    const container = document.getElementById('container-proximos-index');
    if (!container) return;

    try {
        // Tenta carregar ligas principais para a Home
        const idsDestaque = ['4328', '4387']; // Premier League e NBA
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

        const top3 = futuros.slice(0, 3);

        if (top3.length === 0) {
            // Se a API retornar vazio, lança erro para ativar o modo de segurança
            throw new Error("Sem eventos ou API bloqueada"); 
        } else {
            container.innerHTML = top3.map(evento => criarCartaoEvento(evento, 'list')).join('');
        }

    } catch (erro) {
        console.warn("API Indisponível. A ativar Modo de Segurança (Dados de Exemplo).");
        
        // --- DADOS DE EXEMPLO (MODO DE SEGURANÇA) ---
        // Garante que o site nunca fica vazio
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const dataFormatada = amanha.toISOString().split('T')[0];

        const eventosExemplo = [
            {
                idEvent: 'demo1',
                strEvent: 'Sporting CP vs SL Benfica',
                strHomeTeam: 'Sporting CP',
                strAwayTeam: 'SL Benfica',
                dateEvent: dataFormatada,
                strTime: '20:30:00',
                strSport: 'Soccer',
                strLeague: 'Liga Portugal',
                strVenue: 'Estádio José Alvalade',
                intHomeScore: null,
                intAwayScore: null
            },
            {
                idEvent: 'demo2',
                strEvent: 'Lakers vs Warriors',
                strHomeTeam: 'Lakers',
                strAwayTeam: 'Warriors',
                dateEvent: dataFormatada,
                strTime: '01:00:00',
                strSport: 'Basketball',
                strLeague: 'NBA',
                strVenue: 'Crypto.com Arena',
                intHomeScore: null,
                intAwayScore: null
            },
            {
                idEvent: 'demo3',
                strEvent: 'Man City vs Liverpool',
                strHomeTeam: 'Man City',
                strAwayTeam: 'Liverpool',
                dateEvent: dataFormatada,
                strTime: '15:00:00',
                strSport: 'Soccer',
                strLeague: 'Premier League',
                strVenue: 'Etihad Stadium',
                intHomeScore: null,
                intAwayScore: null
            }
        ];
        
        container.innerHTML = eventosExemplo.map(evento => criarCartaoEvento(evento, 'list')).join('');
    }
}

// --- ARRANQUE GLOBAL DA APLICAÇÃO ---
// Este código corre assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
    // Verifica qual página está aberta e inicia a função correta
    if (document.getElementById('container-eventos')) initCalendario();
    if (document.getElementById('container-proximos-index')) initHomepage();
});