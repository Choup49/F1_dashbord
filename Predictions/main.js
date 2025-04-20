// Configuration de base
document.addEventListener('DOMContentLoaded', function() {
    // Charger les données
    fetch('data/predictions.json')
        .then(response => response.json())
        .then(data => {
            updateUI(data);
            checkForResults();
        })
        .catch(error => console.error('Error loading data:', error));

    // Gestion du dark/light mode
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', toggleTheme);
});

function updateUI(data) {
    // Mettre à jour les informations de course
    document.getElementById('circuit-name').textContent = data.circuit.name;
    document.getElementById('race-date').textContent = new Date(data.circuit.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    document.getElementById('last-update').textContent = new Date(data.last_updated).toLocaleString('fr-FR');

    // Mettre à jour le commentaire de l'IA
    document.getElementById('ai-comment').textContent = data.ai_commentary;

    // Générer le top 5 des pilotes
    const topDriversContainer = document.getElementById('top-drivers');
    topDriversContainer.innerHTML = '';
    
    data.top_drivers.forEach((driver, index) => {
        const driverCard = document.createElement('div');
        driverCard.className = 'driver-card';
        driverCard.innerHTML = `
            <span class="driver-pos">${index + 1}</span>
            <span class="driver-name">${driver.name}</span>
            <span class="driver-prob">${(driver.win_probability * 100).toFixed(1)}%</span>
        `;
        topDriversContainer.appendChild(driverCard);
    });

    // Initialiser les graphiques
    initCharts(data);
}

function checkForResults() {
    // Vérifier si les résultats réels sont disponibles
    fetch('data/results.json')
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('No results available yet');
        })
        .then(results => {
            // Activer la section de comparaison
            const comparisonSection = document.getElementById('comparison-section');
            const toggleBtn = document.getElementById('toggle-comparison');
            
            toggleBtn.classList.remove('hidden');
            toggleBtn.addEventListener('click', () => {
                showComparison(results);
                toggleBtn.classList.add('hidden');
            });
        })
        .catch(error => {
            console.log('No race results yet:', error.message);
        });
}

function showComparison(results) {
    // Implémenter la logique de comparaison
    console.log('Showing comparison with:', results);
    // À compléter avec la logique de comparaison
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    // Sauvegarder la préférence
    localStorage.setItem('theme', newTheme);
}

// Vérifier la préférence de thème au chargement
function checkSavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

checkSavedTheme();