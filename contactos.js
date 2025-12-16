(function() {
    // Inicializar EmailJS com a Public Key
    emailjs.init("SuXIiUSIdshUXgy8D");
})();

document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('form-contacto');

    if (contactForm) {
        contactForm.addEventListener('submit', function(event) {
            event.preventDefault();

            // Mudar texto do botão para dar feedback
            const btn = contactForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'A enviar...';
            btn.disabled = true;

            // Parâmetros do serviço
            const serviceID = 'service_ongs88m';
           
            const templateID = 'template_wji8p0a'; 

            // Enviar formulário
            emailjs.sendForm(serviceID, templateID, this)
                .then(function() {
                    alert('Mensagem enviada com sucesso!');
                    contactForm.reset();
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, function(error) {
                    console.error('Falha ao enviar email:', error);
                    alert('Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente mais tarde.');
                    btn.textContent = originalText;
                    btn.disabled = false;
                });
        });
    }

    // --- FAQ ---
    const faqQuestions = document.querySelectorAll('.pergunta-faq');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('i');

            // Toggle ativo
            answer.classList.toggle('active');

            // Rotação da seta
            if (answer.classList.contains('active')) {
                icon.style.transform = 'rotate(180deg)';
            } else {
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
});
