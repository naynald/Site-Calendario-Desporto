// --- CONFIGURAÇÕES INICIAIS ---
const API_KEY = '123'; 
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const CACHE_KEY = 'sportcalendar_cache_v3'; 
const CACHE_DURATION = 24 * 60 * 60 * 1000; 

// --- Configuração da Carteira (Gambling) ---
const WALLET_KEY = 'sportcalendar_wallet';
const BETS_KEY = 'sportcalendar_bets';
const INITIAL_BALANCE = 100;

// Lista de Ligas
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

const sportMap = {
    'football': 'Soccer',
    'basketball': 'Basketball',
    'volleyball': 'Volleyball'
};

// --- ESTADO DO SITE ---
let paginaAtual = 1;
let eventosPorPagina = 12;
let todosEventos = [];    
let eventosFiltrados = []; 

// --- WALLET & BETTING SYSTEM ---

function getWalletBalance() {
    const bal = localStorage.getItem(WALLET_KEY);
    return bal ? parseInt(bal) : INITIAL_BALANCE;
}

function updateWalletUI() {
    const balance = getWalletBalance();
    const els = document.querySelectorAll('#user-balance');
    els.forEach(el => el.textContent = balance);
    
    // Show container if hidden
    const containers = document.querySelectorAll('#wallet-container');
    containers.forEach(c => c.style.display = 'flex');
}

function updateBalance(amount) {
    const current = getWalletBalance();
    const newBal = current + amount;
    localStorage.setItem(WALLET_KEY, newBal);
    updateWalletUI();
    return newBal;
}

function getActiveBets() {
    const bets = localStorage.getItem(BETS_KEY);
    return bets ? JSON.parse(bets) : [];
}

function placeBet(eventId, choice, odds = 2.0) {
    const amount = 10; // Custo fixo por aposta para simplificar
    if (getWalletBalance() < amount) {
        alert("Saldo insuficiente! Precisas de 10 fichas.");
        return;
    }

    updateBalance(-amount);
    
    const bets = getActiveBets();
    bets.push({
        id: Date.now(),
        eventId: eventId,
        choice: choice, // 'home', 'draw', 'away'
        amount: amount,
        odds: odds,
        status: 'open' // open, won, lost
    });
    
    localStorage.setItem(BETS_KEY, JSON.stringify(bets));
    alert(`Aposta de ${amount} fichas confirmada em '${choice}'!`);
    renderizarEventos(document.querySelector('.botao-vista.active')?.dataset.view || 'list');
}

function resolveBets(event) {
    const bets = getActiveBets();
    let changed = false;

    bets.forEach(bet => {
        if (bet.status === 'open' && bet.eventId === event.idEvent) {
            // Check result
            let result = null;
            const h = parseInt(event.intHomeScore);
            const a = parseInt(event.intAwayScore);
            
            if (isNaN(h) || isNaN(a)) return; // No result yet

            if (h > a) result = 'home';
            else if (a > h) result = 'away';
            else result = 'draw';

            if (bet.choice === result) {
                const winnings = bet.amount * bet.odds;
                updateBalance(winnings);
                bet.status = 'won';
                alert(`Parabéns! Ganhaste ${winnings} fichas na aposta do jogo ${event.strEvent}!`);
            } else {
                bet.status = 'lost';
            }
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem(BETS_KEY, JSON.stringify(bets));
    }
}

// --- RESULT SIMULATION (GAMBLING ENABLER) ---
// Como muitos jogos são no futuro, adicionamos um botão para "Simular" um resultado
// e assim permitir testar o sistema de apostas.
function simularResultado(eventId) {
    const ev = todosEventos.find(e => e.idEvent === eventId);
    if (!ev) return;

    // Gerar random score
    ev.intHomeScore = Math.floor(Math.random() * 5);
    ev.intAwayScore = Math.floor(Math.random() * 5);
    
    // Atualizar cache
    guardarEmCache(todosEventos);
    
    // Resolver apostas
    resolveBets(ev);
    
    // Re-render
    renderizarEventos(document.querySelector('.botao-vista.active')?.dataset.view || 'list');
}


// --- SISTEMA DE CACHE ---
function guardarEmCache(dados) {
    const pacote = {
        timestamp: new Date().getTime(),
        eventos: dados
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(pacote));
}

function lerDoCache() {
    const dadosGuardados = localStorage.getItem(CACHE_KEY);
    if (!dadosGuardados) return null; 

    const pacote = JSON.parse(dadosGuardados);
    const agora = new Date().getTime();

    if (agora - pacote.timestamp < CACHE_DURATION) {
        return pacote.eventos;
    }
    return null; 
}

// --- HELPERS ---
function formatarData(dateStr) {
    if (!dateStr) return { day: '--', month: '--' };
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return { day, month: months[date.getMonth()] };
}

function formatarHora(timeStr) {
    if (!timeStr) return 'TBD';
    return timeStr.substring(0, 5);
}

function obterIconeDesporto(sportName) {
    const s = (sportName || '').toLowerCase();
    if (s.includes('soccer') || s.includes('football')) return 'fa-futbol';
    if (s.includes('basketball') || s.includes('nba')) return 'fa-basketball-ball';
    if (s.includes('volleyball')) return 'fa-volleyball-ball';
    return 'fa-calendar-alt';
}

function ordenarPorProximidade(lista) {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    return lista.sort((a, b) => {
        const dA = new Date(a.dateEvent + 'T' + (a.strTime || '00:00'));
        const dB = new Date(b.dateEvent + 'T' + (b.strTime || '00:00'));
        const diffA = Math.abs(dA - hoje);
        const diffB = Math.abs(dB - hoje);
        if (diffA !== diffB) return diffA - diffB;
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

// --- API FETCH ---
async function buscarEventosRecentes(leagueId) {
    const urlNext = `${BASE_URL}/${API_KEY}/eventsnextleague.php?id=${leagueId}`;
    const urlPast = `${BASE_URL}/${API_KEY}/eventspastleague.php?id=${leagueId}`;

    try {
        const [resNext, resPast] = await Promise.all([
            fetch(urlNext).then(r => r.json()),
            fetch(urlPast).then(r => r.json())
        ]);

        const nextEvents = resNext.events || [];
        const pastEvents = resPast.events || [];
        return [...nextEvents, ...pastEvents];
    } catch (error) {
        console.warn(`Erro na liga ${leagueId}`, error);
        return []; 
    }
}

async function buscarTodosEventos() {
    const dadosCache = lerDoCache();
    if (dadosCache) return dadosCache; 

    // Simulação de delay para loading
    const events = [];
    let todasLigas = [];
    Object.values(configLigas).forEach(lista => lista.forEach(l => todasLigas.push(l)));
    
    const statusLoading = document.querySelector('.carregamento p');

    for (const [index, liga] of todasLigas.entries()) {
        if(statusLoading) statusLoading.textContent = `A carregar ${liga.nome} (${index + 1}/${todasLigas.length})...`;
        try {
            const leagueEvents = await buscarEventosRecentes(liga.id);
            if (leagueEvents) events.push(...leagueEvents);
            await new Promise(r => setTimeout(r, 800)); // Delay menor
        } catch (err) { }
    }

    const uniqueEvents = Array.from(new Map(events.map(e => [e.idEvent, e])).values());
    const ordenados = ordenarPorProximidade(uniqueEvents);
    guardarEmCache(ordenados);
    return ordenados;
}

// --- CRIAR CARTÕES ---
function criarCartaoEvento(event, viewType = 'list') {
    const { day, month } = formatarData(event.dateEvent);
    const time = formatarHora(event.strTime);
    const sportIcon = obterIconeDesporto(event.strSport);
    
    // Check results
    const hasScore = event.intHomeScore !== null && event.intHomeScore !== undefined;
    
    // Betting State
    const myBets = getActiveBets().filter(b => b.eventId === event.idEvent);
    const hasBet = myBets.length > 0;
    
    let conteudoExtra = '';
    let badgeEstado = '';

    if (hasScore) {
        // Jogo Terminado
        badgeEstado = `<span style="background: var(--cor-primaria); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">Terminado</span>`;
        conteudoExtra = `
            <div style="margin-top: 10px;">
                <a href="resultados.html?id=${event.idEvent}" class="botao" style="font-size: 0.9rem; padding: 0.5rem 1rem;">Ver Resultado</a>
            </div>
        `;
    } else {
        // Jogo Por Decorrer (Apostas)
        badgeEstado = `<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">Em Breve</span>`;
        conteudoExtra = `
            <div class="apostas-container">
                <button class="btn-aposta" onclick="placeBet('${event.idEvent}', 'home')" ${hasBet ? 'disabled' : ''}>${event.strHomeTeam.substring(0,3)}</button>
                <button class="btn-aposta" onclick="placeBet('${event.idEvent}', 'draw')" ${hasBet ? 'disabled' : ''}>X</button>
                <button class="btn-aposta" onclick="placeBet('${event.idEvent}', 'away')" ${hasBet ? 'disabled' : ''}>${event.strAwayTeam.substring(0,3)}</button>
                <button class="btn-simular" onclick="simularResultado('${event.idEvent}')" title="Simular Resultado (Admin)"><i class="fas fa-magic"></i></button>
            </div>
        `;
    }
    
    if (hasBet) {
        let betStatus = hasScore ? (myBets[0].status === 'won' ? '<span style="color:var(--cor-sucesso)">(Ganhou!)</span>' : '<span style="color:red">(Perdeu)</span>') : '';
        conteudoExtra += `<p style="font-size:0.8rem; color: #fbbf24; margin-top:0.5rem;"><i class="fas fa-ticket-alt"></i> Aposta: ${myBets[0].choice} ${betStatus}</p>`;
    }

    const titulo = event.strEvent || `${event.strHomeTeam} vs ${event.strAwayTeam}`;

    if (viewType === 'list') {
        return `
            <div class="cartao-evento">
                <div class="data-evento"><span class="dia">${day}</span><span class="mes">${month}</span></div>
                <div class="info-evento">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h3>${titulo}</h3>
                        ${badgeEstado}
                    </div>
                    <p><i class="fas ${sportIcon}"></i> ${event.strLeague}</p>
                    <p><i class="far fa-clock"></i> ${time}</p>
                    ${conteudoExtra}
                </div>
            </div>`;
    } else {
        return `
            <div class="cartao-evento-grelha">
                <div class="cabecalho-evento"><span>${day} ${month}</span><span>${time}</span></div>
                <div class="corpo-evento">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        ${badgeEstado}
                    </div>
                    <h3>${titulo}</h3>
                    <p><i class="fas ${sportIcon}"></i> ${event.strSport}</p>
                    ${conteudoExtra}
                </div>
            </div>`;
    }
}


// --- RENDER ---
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
    const sport = document.getElementById('desporto').value;
    const lg = document.getElementById('liga').value;
    const dt = document.getElementById('data').value;
    const tm = document.getElementById('equipa').value.toLowerCase();
    
    let tempEventos = todosEventos.filter(e => {
        if (sport !== 'all' && e.strSport !== sportMap[sport]) return false;
        if (lg !== 'all' && e.idLeague !== lg) return false;
        if (dt && e.dateEvent !== dt) return false;
        if (tm && !(e.strEvent+e.strHomeTeam+e.strAwayTeam).toLowerCase().includes(tm)) return false;
        return true;
    });
    
    eventosFiltrados = ordenarPorProximidade(tempEventos);
    paginaAtual = 1;
    const view = document.querySelector('.botao-vista.active') ? document.querySelector('.botao-vista.active').dataset.view : 'list';
    renderizarEventos(view);
}

function limparFiltros() {
    document.getElementById('desporto').value = 'all';
    atualizarDropdownLigas();
    document.getElementById('liga').value = 'all';
    document.getElementById('data').value = '';
    document.getElementById('equipa').value = '';
    eventosFiltrados = [...todosEventos];
    paginaAtual = 1;
    renderizarEventos('list');
}

// --- INIT ---
async function initCalendario() {
    const container = document.getElementById('container-eventos');
    container.innerHTML = `<div class="carregamento"><i class="fas fa-spinner fa-spin"></i><p>A atualizar base de dados...</p></div>`;
    
    updateWalletUI(); // Init Wallet
    atualizarDropdownLigas();
    todosEventos = await buscarTodosEventos();
    
    // Check for betting resolutions on load
    todosEventos.forEach(ev => resolveBets(ev));
    
    eventosFiltrados = [...todosEventos];
    renderizarEventos('list');
    
    document.getElementById('aplicar-filtros').addEventListener('click', aplicarFiltros);
    document.getElementById('limpar-filtros').addEventListener('click', limparFiltros);
    document.getElementById('desporto').addEventListener('change', atualizarDropdownLigas);
    
    document.getElementById('pagina-anterior').addEventListener('click', () => { if(paginaAtual>1){ paginaAtual--; renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); window.scrollTo({top:0,behavior:'smooth'});}});
    document.getElementById('pagina-seguinte').addEventListener('click', () => { const t=Math.ceil(eventosFiltrados.length/eventosPorPagina); if(paginaAtual<t){ paginaAtual++; renderizarEventos(document.querySelector('.botao-vista.active').dataset.view); window.scrollTo({top:0,behavior:'smooth'});}});
    
    document.querySelectorAll('.botao-vista').forEach(b => b.addEventListener('click', function() { document.querySelectorAll('.botao-vista').forEach(x=>x.classList.remove('active')); this.classList.add('active'); renderizarEventos(this.dataset.view); }));
}

async function initHomepage() {
    const container = document.getElementById('container-proximos-index');
    if(!container) return;
    updateWalletUI(); 
    
    let todos = await buscarTodosEventos(); 
    const top3 = todos.slice(0, 3);
    if(top3.length === 0) container.innerHTML = '<p>Sem eventos.</p>';
    else container.innerHTML = top3.map(e => criarCartaoEvento(e, 'list')).join('');
}

// Global functions for inline HTML calls
window.placeBet = placeBet;
window.simularResultado = simularResultado;

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('container-eventos')) initCalendario();
    if(document.getElementById('container-proximos-index')) initHomepage();
});