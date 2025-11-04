// Renomeado de script.js para logica.js
const API_KEY = '123'; // API Key gratuita para testes
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

// Estado da aplicação
let paginaAtual = 1;
let eventosPorPagina = 12;
let todosEventos = [];
let eventosFiltrados = [];

// Mapeamento de desportos para IDs da API
const idsDesportos = {
    'football': '4328',      // Soccer/Football
    'basketball': '4387',    // Basketball
    'volleyball': '4385'     // Volleyball
};

// Mapeamento de ligas
const idsLigas = {
    'premier': '4328',       // Premier League
    'liga': '4344',          // Liga Portugal
    'nba': '4387',           // NBA
    'champions': '4480'      // UEFA Champions League
};

// Função para formatar data
function formatarData(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const month = months[date.getMonth()];
    return { day, month };
}

// Função para formatar hora
function formatarHora(timeStr) {
    if (!timeStr) return 'A definir';
    return timeStr.substring(0, 5);
}

// Função para obter ícone do desporto
function obterIconeDesporto(sport) {
    const icons = {
        'Soccer': 'fa-futbol',
        'Basketball': 'fa-basketball-ball',
        'Volleyball': 'fa-volleyball-ball'
    };
    return icons[sport] || 'fa-calendar';
}

// Função para buscar eventos da próxima semana por liga
async function buscarEventosProximosPorLiga(leagueId) {
    try {
        const response = await fetch(`${BASE_URL}/${API_KEY}/eventsnextleague.php?id=${leagueId}`);
        const data = await response.json();
        return data.events || [];
    } catch (error) {
        console.error('Erro ao buscar eventos próximos:', error);
        return [];
    }
}

// --- NOVO ---
// Função para buscar eventos passados por liga
async function buscarEventosPassadosPorLiga(leagueId) {
    try {
        // A API gratuita 'eventspastleague.php' retorna os últimos 15 eventos
        const response = await fetch(`${BASE_URL}/${API_KEY}/eventspastleague.php?id=${leagueId}`);
        const data = await response.json();
        return data.events || [];
    } catch (error) {
        console.error('Erro ao buscar eventos passados:', error);
        return [];
    }
}

// --- MODIFICADO ---
// Função para buscar todos os eventos (próximos E passados)
async function buscarTodosEventos() {
    const events = [];
    
    // Buscar eventos das principais ligas (IDs definidos em idsLigas)
    const leagues = Object.values(idsLigas);
    
    for (const leagueId of leagues) {
        // Buscar próximos eventos
        const proximosEventos = await buscarEventosProximosPorLiga(leagueId);
        events.push(...proximosEventos);
        
        // Buscar eventos passados (para mostrar resultados)
        const eventosPassados = await buscarEventosPassadosPorLiga(leagueId);
        events.push(...eventosPassados);
    }
    
    // Remover duplicados (caso a API retorne algum)
    const eventosUnicos = Array.from(new Map(events.map(e => [e.idEvent, e])).values());

    // Ordenar por data (mais recente primeiro)
    return eventosUnicos.sort((a, b) => {
        return new Date(b.dateEvent + 'T' + b.strTime) - new Date(a.dateEvent + 'T' + a.strTime);
    });
}

// --- MODIFICADO ---
// Função para criar card de evento
function criarCartaoEvento(event, viewType = 'list') {
    const { day, month } = formatarData(event.dateEvent);
    const time = formatarHora(event.strTime);
    const sportIcon = obterIconeDesporto(event.strSport);

    // --- LÓGICA DE RESULTADO ---
    // Verifica se o jogo já tem resultado (pontuação não é nula)
    const temResultado = event.intHomeScore !== null && event.intAwayScore !== null;
    let linkResultado = '';

    if (temResultado) {
        // Adiciona a seta que leva à página de resultados
        linkResultado = `
            <a href="resultados.html?id=${event.idEvent}" class="link-resultado" title="Ver Resultado">
                <i class="fas fa-chevron-right"></i>
            </a>
        `;
    }
    
    if (viewType === 'list') {
        return `
            <div class="cartao-evento">
                <div class="data-evento">
                    <span class="dia">${day}</span>
                    <span class="mes">${month}</span>
                </div>
                <div class="info-evento">
                    <h3>${event.strEvent || event.strHomeTeam + ' vs ' + event.strAwayTeam}</h3>
                    <p><i class="fas ${sportIcon}"></i> ${event.strSport} - ${event.strLeague}</p>
                    <p><i class="far fa-clock"></i> ${time} ${event.strVenue ? '| ' + event.strVenue : ''}</p>
                </div>
                ${linkResultado} 
            </div>
        `;
    } else {
        // Vista em Grelha
        return `
            <div class="cartao-evento-grelha">
                <div class="cabecalho-evento">
                    <span class="data-evento-pequena">${day} ${month}</span>
                    <span class="hora-evento">${time}</span>
                </div>
                <div class="corpo-evento">
                    <h3>${event.strEvent || event.strHomeTeam + ' vs ' + event.strAwayTeam}</h3>
                    <p><i class="fas ${sportIcon}"></i> ${event.strSport}</p>
                    <p class="liga">${event.strLeague}</p>
                </div>
                ${temResultado ? `<a href="resultados.html?id=${event.idEvent}" class="link-resultado-grelha">Ver Resultado</a>` : ''}
            </div>
        `;
    }
}

// Função para renderizar eventos
function renderizarEventos(viewType = 'list') {
    const container = document.getElementById('container-eventos'); // ID modificado
    
    if (eventosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="sem-eventos">
                <i class="fas fa-calendar-times"></i>
                <p>Nenhum evento encontrado com os filtros aplicados.</p>
            </div>
        `;
        // Certifica-se que a paginação está correta
        atualizarPaginacao();
        return;
    }
    
    const start = (paginaAtual - 1) * eventosPorPagina;
    const end = start + eventosPorPagina;
    const eventsToShow = eventosFiltrados.slice(start, end);
    
    const containerClass = viewType === 'list' ? 'lista-eventos' : 'grelha-eventos'; // Classes modificadas
    container.className = containerClass;
    
    container.innerHTML = eventsToShow.map(event => criarCartaoEvento(event, viewType)).join('');
    
    atualizarPaginacao();
}

// Função para atualizar paginação
function atualizarPaginacao() {
    const totalPages = Math.ceil(eventosFiltrados.length / eventosPorPagina) || 1;
    document.getElementById('pagina-atual').textContent = paginaAtual; // ID modificado
    document.getElementById('paginas-totais').textContent = totalPages; // ID modificado
    
    document.getElementById('pagina-anterior').disabled = paginaAtual === 1; // ID modificado
    document.getElementById('pagina-seguinte').disabled = paginaAtual === totalPages; // ID modificado
}

// Função para aplicar filtros
function aplicarFiltros() {
    const sport = document.getElementById('desporto').value; // ID modificado
    const league = document.getElementById('liga').value; // ID modificado
    const date = document.getElementById('data').value; // ID modificado
    const team = document.getElementById('equipa').value.toLowerCase(); // ID modificado
    
    eventosFiltrados = todosEventos.filter(event => {
        if (sport !== 'all') {
            const sportMap = {
                'football': 'Soccer',
                'basketball': 'Basketball',
                'volleyball': 'Volleyball'
            };
            if (event.strSport !== sportMap[sport]) return false;
        }
        
        if (league !== 'all') {
            // Usamos o ID da liga que guardámos
            if (event.idLeague !== idsLigas[league]) return false;
        }
        
        if (date) {
            if (event.dateEvent !== date) return false;
        }
        
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
    renderizarEventos(document.querySelector('.botao-vista.active').dataset.view);
}

// Função para limpar filtros
function limparFiltros() {
    document.getElementById('desporto').value = 'all'; // ID modificado
    document.getElementById('liga').value = 'all'; // ID modificado
    document.getElementById('data').value = ''; // ID modificado
    document.getElementById('equipa').value = ''; // ID modificado
    
    eventosFiltrados = [...todosEventos];
    paginaAtual = 1;
    renderizarEventos(document.querySelector('.botao-vista.active').dataset.view);
}

// Inicialização
async function initCalendario() {
    // Mostrar loading
    const container = document.getElementById('container-eventos'); // ID modificado
    container.innerHTML = `
        <div class="carregamento">
            <i class="fas fa-spinner fa-spin"></i>
            <p>A carregar eventos...</p>
        </div>
    `;
    
    // Buscar eventos
    todosEventos = await buscarTodosEventos();
    eventosFiltrados = [...todosEventos];
    
    // Renderizar eventos
    renderizarEventos('list');
    
    // Event listeners com IDs modificados
    document.getElementById('aplicar-filtros').addEventListener('click', aplicarFiltros);
    document.getElementById('limpar-filtros').addEventListener('click', limparFiltros);
    
    document.getElementById('pagina-anterior').addEventListener('click', () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarEventos(document.querySelector('.botao-vista.active').dataset.view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    document.getElementById('pagina-seguinte').addEventListener('click', () => {
        const totalPages = Math.ceil(eventosFiltrados.length / eventosPorPagina);
        if (paginaAtual < totalPages) {
            paginaAtual++;
            renderizarEventos(document.querySelector('.botao-vista.active').dataset.view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    // View toggle
    document.querySelectorAll('.botao-vista').forEach(btn => { // Classe modificada
        btn.addEventListener('click', function() {
            document.querySelectorAll('.botao-vista').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderizarEventos(this.dataset.view);
        });
    });
}

// Iniciar quando a página carregar
// Verificamos se estamos na página do calendário
if (document.getElementById('container-eventos')) {
    document.addEventListener('DOMContentLoaded', initCalendario);
}

// FAQ accordion (para página de contactos)
document.addEventListener('DOMContentLoaded', () => {
    const faqQuestions = document.querySelectorAll('.pergunta-faq'); // Classe modificada
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('i');
            
            answer.classList.toggle('active');
            icon.style.transform = answer.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0)';
        });
    });
    
    // Form de contacto
    const contactForm = document.getElementById('form-contacto'); // ID modificado
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Mensagem enviada com sucesso! Entraremos em contacto em breve.');
            contactForm.reset();
        });
    }
});