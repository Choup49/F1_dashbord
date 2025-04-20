function initCharts(data) {
    // Tri des données pour les graphiques
    const drivers = data.drivers.sort((a, b) => b.win_probability - a.win_probability);
    const driverNames = drivers.map(d => d.name);
    const winProbs = drivers.map(d => d.win_probability * 100);
    const podiumProbs = drivers.map(d => d.podium_probability * 100);

    // Graphique des probabilités de victoire
    const winCtx = document.getElementById('winChart').getContext('2d');
    new Chart(winCtx, {
        type: 'bar',
        data: {
            labels: driverNames.slice(0, 10), // Top 10 seulement
            datasets: [{
                label: 'Probabilité de victoire (%)',
                data: winProbs.slice(0, 10),
                backgroundColor: '#e10600',
                borderColor: '#b30500',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });

    // Graphique des probabilités de podium
    const podiumCtx = document.getElementById('podiumChart').getContext('2d');
    new Chart(podiumCtx, {
        type: 'doughnut',
        data: {
            labels: driverNames.slice(0, 5), // Top 5 seulement
            datasets: [{
                label: 'Probabilité de podium (%)',
                data: podiumProbs.slice(0, 5),
                backgroundColor: [
                    '#e10600',
                    '#1e1e1e',
                    '#333333',
                    '#555555',
                    '#777777'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value.toFixed(1)}%`;
                        }
                    }
                },
                legend: {
                    position: 'right',
                }
            }
        }
    });
}