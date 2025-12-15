// --- LÓGICA PARA A PÁGINA DE RESULTADOS ---

const API_KEY = '123'; 
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const WALLET_KEY = 'sportcalendar_wallet';

function updateWalletUI() {
    const bal = localStorage.getItem(WALLET_KEY) || 100;
    const els = document.querySelectorAll('#user-balance');
    els.forEach(el => el.textContent = bal);
    const containers = document.querySelectorAll('#wallet-container');
    containers.forEach(c => c.style.display = 'flex');
}


// Função para buscar detalhes de um evento específico pelo ID
async function buscarDetalheEvento(idEvento) {
    try {
        const response = await fetch(`${BASE_URL}/${API_KEY}/lookupevent.php?id=${idEvento}`);
        const data = await response.json();
        return data.events && data.events.length > 0 ? data.events[0] : null;
    } catch (error) {
        console.error('Erro ao buscar detalhe do evento:', error);
        return null;
    }
}

// Função para renderizar os detalhes do resultado
function renderizarResultado(evento) {
    const container = document.getElementById('container-resultado');
    
    if (!evento) {
        container.innerHTML = `
            <div class="sem-eventos">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Não foi possível carregar os detalhes do resultado para este evento.</p>
                <a href="calendario.html" class="botao">Voltar ao Calendário</a>
            </div>
        `;
        return;
    }

    // Formatar o resultado
    const resultadoCasa = evento.intHomeScore ?? '-';
    const resultadoFora = evento.intAwayScore ?? '-';
    const estado = evento.strStatus.includes('Finished') ? 'Terminado' : 'Em breve';

    container.innerHTML = `
        <div class="cartao-resultado">
            <div class="cabecalho-resultado">
                <h2>${evento.strEvent}</h2>
                <span class="estado-jogo ${estado.toLowerCase()}">${estado}</span>
            </div>
            <div class="corpo-resultado">
                <div class="info-jogo">
                    <p><i class="fas fa-calendar-day"></i> <strong>Data:</strong> ${evento.dateEvent}</p>
                    <p><i class="far fa-clock"></i> <strong>Hora:</strong> ${evento.strTime.substring(0, 5)}</p>
                    <p><i class="fas fa-map-marker-alt"></i> <strong>Local:</strong> ${evento.strVenue || 'A definir'}</p>
                    <p><i class="fas fa-trophy"></i> <strong>Competição:</strong> ${evento.strLeague}</p>
                </div>
                <div class="placar">
                    <div class="equipa">
                        <img src="${evento.strHomeTeamBadge || ''}" alt="${evento.strHomeTeam}" class="emblema-equipa">
                        <h3>${evento.strHomeTeam}</h3>
                    </div>
                    <div class="pontuacao">
                        <span>${resultadoCasa}</span> : <span>${resultadoFora}</span>
                    </div>
                    <div class="equipa">
                        <img src="${evento.strAwayTeamBadge || ''}" alt="${evento.strAwayTeam}" class="emblema-equipa">
                        <h3>${evento.strAwayTeam}</h3>
                    </div>
                </div>
            </div>
            <div class="rodape-resultado">
                <a href="calendario.html" class="botao-secundario">Voltar ao Calendário</a>
            </div>
        </div>
    `;
}


// Inicialização da página de resultados
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obter o ID do evento a partir do URL
    const urlParams = new URLSearchParams(window.location.search);
    const idEvento = urlParams.get('id');

    if (!idEvento) {
        // Se não houver ID, mostra erro
        renderizarResultado(null);
        return;
    }

    // 2. Notificação de acesso (mensagem "A carregar...") já está no HTML
    
    // 3. Buscar os dados do evento
    const evento = await buscarDetalheEvento(idEvento);

    // 4. Renderizar o resultado
    renderizarResultado(evento);
    
    // 5. Init Wallet
    updateWalletUI();
});