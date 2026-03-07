// Gestione Burger Menu
const burgerMenu = document.querySelector('.burger-menu');
const navOverlay = document.getElementById('navOverlay');
const navLinks = document.querySelectorAll('.nav-overlay-menu .nav-link');

function closeOverlay() {
    burgerMenu.classList.remove('active');
    navOverlay.classList.remove('active');
}

burgerMenu.addEventListener('click', () => {
    burgerMenu.classList.toggle('active');
    navOverlay.classList.toggle('active');
});

navLinks.forEach(link => {
    link.addEventListener('click', closeOverlay);
});

document.addEventListener('click', (e) => {
    if (!burgerMenu.contains(e.target) && !navOverlay.contains(e.target)) {
        closeOverlay();
    }
});

// ===== COUNTDOWN =====
// Imposta la data target (modifica questa data come preferisci)
// Formato: Anno, Mese (0-11), Giorno, Ora, Minuti, Secondi
const targetDate = new Date(2026, 6, 18, 15, 59, 59).getTime(); // 31 Dicembre 2025, 23:59:59
// Elementi del countdown
const daysElement = document.getElementById('days');
const hoursElement = document.getElementById('hours');
const minutesElement = document.getElementById('minutes');
const secondsElement = document.getElementById('seconds');

// Funzione per aggiornare il countdown
function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate - now;

    // Calcola giorni, ore, minuti e secondi
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Aggiungi lo zero davanti se necessario
    const formatNumber = (num) => num < 10 ? '0' + num : num;

    // Aggiorna i valori con animazione
    if (distance > 0) {
        daysElement.textContent = formatNumber(days);
        hoursElement.textContent = formatNumber(hours);
        minutesElement.textContent = formatNumber(minutes);
        secondsElement.textContent = formatNumber(seconds);
    } else {
        // Countdown terminato
        daysElement.textContent = '00';
        hoursElement.textContent = '00';
        minutesElement.textContent = '00';
        secondsElement.textContent = '00';
        clearInterval(countdownInterval);
    }
}

// Aggiorna il countdown immediatamente
updateCountdown();

// Aggiorna il countdown ogni secondo
const countdownInterval = setInterval(updateCountdown, 1000);