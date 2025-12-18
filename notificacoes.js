function mostrarNotificacao(mensagem, tipo = "info", duracao = 4000) {
  //Verificar se o container já existe, se não, criar
  let container = document.getElementById("container-notificacoes");
  if (!container) {
    container = document.createElement("div");
    container.id = "container-notificacoes";
    document.body.appendChild(container);
  }

  const notificacao = document.createElement("div");
  notificacao.classList.add("notificacao-toast");
  notificacao.classList.add(tipo);

  //Ícones baseados no tipo
  let icone = "fa-info-circle";
  if (tipo === "sucesso") icone = "fa-check-circle";
  if (tipo === "erro") icone = "fa-exclamation-circle";
  if (tipo === "aviso") icone = "fa-exclamation-triangle";

  notificacao.innerHTML = `
        <i class="fas ${icone}"></i>
        <span>${mensagem}</span>
        <div class="barra-progresso"></div>
    `;
  container.appendChild(notificacao);

  //Remover após a duração
  setTimeout(() => {
    notificacao.classList.add("sair");
    notificacao.addEventListener("animationend", () => {
      if (notificacao.parentElement) {
        notificacao.remove();
      }
    });
  }, duracao);
}

//Tornar global
window.mostrarNotificacao = mostrarNotificacao;
