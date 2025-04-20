// Configuration de l'API
    const API_BASE_URL = "https://api.openf1.org/v1";
    const CURRENT_YEAR = new Date().getFullYear();
    const SESSION_TYPES = {
      'Practice 1': 'EL1',
      'Practice 2': 'EL2',
      'Practice 3': 'EL3',
      'Qualifying': 'Qualifs',
      'Sprint': 'Sprint',
      'Race': 'Course'
    };

    // Variables globales
    let currentSessionKey = null;
    let currentMeetingKey = null;
    let driversData = {};
    let teamsData = {};
    let intervalsData = [];
    let lastRequestTime = 0;
    const REQUEST_DELAY = 1500; // 1.5 seconde entre les requêtes
    let usingLocalData = false;

    // Données de fallback
    const FALLBACK_MEETINGS = [
      { meeting_key: 1219, meeting_name: "Grand Prix de Singapour", circuit_short_name: "Singapore", date_start: "2023-09-15" },
      { meeting_key: 1220, meeting_name: "Grand Prix du Japon", circuit_short_name: "Suzuka", date_start: "2023-09-22" }
    ];

    const FALLBACK_DRIVERS = {
  1: { name: "Max Verstappen", team: "Red Bull Racing", teamKey: "red-bull-racing" },
  30: { name: "Liam Lawson", team: "Red Bull Racing", teamKey: "red-bull-racing" },
  16: { name: "Charles Leclerc", team: "Ferrari", teamKey: "ferrari" },
  44: { name: "Lewis Hamilton", team: "Ferrari", teamKey: "ferrari" },
  4: { name: "Lando Norris", team: "McLaren", teamKey: "mclaren" },
  81: { name: "Oscar Piastri", team: "McLaren", teamKey: "mclaren" },
  63: { name: "George Russell", team: "Mercedes", teamKey: "mercedes" },
  12: { name: "Andrea Kimi Antonelli", team: "Mercedes", teamKey: "mercedes" },
  14: { name: "Fernando Alonso", team: "Aston Martin", teamKey: "aston-martin" },
  18: { name: "Lance Stroll", team: "Aston Martin", teamKey: "aston-martin" },
  22: { name: "Yuki Tsunoda", team: "Racing Bulls", teamKey: "racing-bulls" },
  6: { name: "Isack Hadjar", team: "Racing Bulls", teamKey: "racing-bulls" },
  31: { name: "Esteban Ocon", team: "Haas", teamKey: "haas" },
  87: { name: "Oliver Bearman", team: "Haas", teamKey: "haas" },
  10: { name: "Pierre Gasly", team: "Alpine", teamKey: "alpine" },
  7: { name: "Jack Doohan", team: "Alpine", teamKey: "alpine" },
  23: { name: "Alexander Albon", team: "Williams", teamKey: "williams" },
  55: { name: "Carlos Sainz", team: "Williams", teamKey: "williams" },
  27: { name: "Nico Hülkenberg", team: "Sauber", teamKey: "sauber" },
  5: { name: "Gabriel Bortoleto", team: "Sauber", teamKey: "sauber" }
};


const FALLBACK_TEAMS = {
  'red-bull-racing': { color: '#3671C6', name: 'Red Bull Racing' },
  'ferrari': { color: '#F91536', name: 'Ferrari' },
  'mercedes': { color: '#6CD3BF', name: 'Mercedes' },
  'mclaren': { color: '#F58020', name: 'McLaren' },
  'aston-martin': { color: '#229971', name: 'Aston Martin' },
  'racing-bulls': { color: '#6692FF', name: 'Racing Bulls' },
  'haas': { color: '#B6BABD', name: 'Haas' },
  'alpine': { color: '#2293D1', name: 'Alpine' },
  'williams': { color: '#64C4FF', name: 'Williams' },
  'sauber': { color: '#52E252', name: 'Sauber' } // ex-Alfa Romeo / Stake F1
};


    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
    });

    async function initializeApp() {
      try {
        // Charger d'abord les données locales
        loadLocalData();
        
        // Puis essayer de mettre à jour depuis l'API
        await safeLoadMeetings();
        
        // Configurer les événements
        document.getElementById('meeting-select').addEventListener('change', loadSessionsForMeeting);
        document.getElementById('session-select').addEventListener('change', function() {
          currentSessionKey = this.value;
          if (this.value) {
            fetchStandings();
          }
        });
        
        // Actualiser automatiquement toutes les 30 secondes
        setInterval(() => {
          if (currentSessionKey) {
            fetchStandings();
          }
        }, 30000);
      } catch (error) {
        console.error("Erreur d'initialisation:", error);
        showError("Erreur lors du chargement de l'application");
      }
    }

    function loadLocalData() {
      // Charger les données locales en premier
      const meetingSelect = document.getElementById('meeting-select');
      meetingSelect.innerHTML = '<option value="">Sélectionnez un Grand Prix</option>';
      FALLBACK_MEETINGS.forEach(meeting => {
        const option = document.createElement('option');
        option.value = meeting.meeting_key;
        option.textContent = `${meeting.meeting_name}`;
        option.dataset.circuit = meeting.circuit_short_name;
        meetingSelect.appendChild(option);
      });

      driversData = FALLBACK_DRIVERS;
      teamsData = FALLBACK_TEAMS;
    }

    async function safeLoadMeetings() {
      try {
        await delayIfNeeded();
        
        const response = await fetch(`${API_BASE_URL}/meetings?year=${CURRENT_YEAR}`);
        
        if (!response.ok) {
          if (response.status === 429) {
            showApiWarning();
            return;
          }
          throw new Error(`Erreur HTTP! statut: ${response.status}`);
        }
        
        const meetings = await response.json();
        if (!Array.isArray(meetings) || meetings.length === 0) {
          return; // On garde les données locales
        }

        // Mettre à jour la liste des meetings
        const meetingSelect = document.getElementById('meeting-select');
        meetingSelect.innerHTML = '<option value="">Sélectionnez un Grand Prix</option>';
        meetings.sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
          .forEach(meeting => {
            const option = document.createElement('option');
            option.value = meeting.meeting_key;
            option.textContent = `${meeting.meeting_name}`;
            option.dataset.circuit = meeting.circuit_short_name;
            meetingSelect.appendChild(option);
          });
      } catch (error) {
        console.error("Erreur de chargement des meetings:", error);
        showApiWarning();
      }
    }

    function showApiWarning() {
      usingLocalData = true;
      document.getElementById('api-warning').style.display = 'flex';
    }

    async function delayIfNeeded() {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      
      if (timeSinceLastRequest < REQUEST_DELAY) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
      }
      
      lastRequestTime = Date.now();
    }

    async function loadSessionsForMeeting() {
      const meetingSelect = document.getElementById('meeting-select');
      const sessionSelect = document.getElementById('session-select');
      currentMeetingKey = meetingSelect.value;
      
      if (!currentMeetingKey) {
        sessionSelect.innerHTML = '<option value="">Sélectionnez d\'abord un GP</option>';
        sessionSelect.disabled = true;
        return;
      }
      
      sessionSelect.innerHTML = '<option value="">Chargement...</option>';
      sessionSelect.disabled = true;
      
      try {
        await delayIfNeeded();
        
        const response = await fetch(`${API_BASE_URL}/sessions?meeting_key=${currentMeetingKey}`);
        
        if (!response.ok) {
          if (response.status === 429) {
            showApiWarning();
            sessionSelect.innerHTML = '<option value="">Données non disponibles</option>';
            return;
          }
          throw new Error(`Erreur HTTP! statut: ${response.status}`);
        }
        
        const sessions = await response.json();
        if (!Array.isArray(sessions) || sessions.length === 0) {
          sessionSelect.innerHTML = '<option value="">Aucune session disponible</option>';
          return;
        }

        // Trier les sessions par ordre chronologique
        sessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

        sessionSelect.innerHTML = '<option value="">Sélectionnez une session</option>';
        sessions.forEach(session => {
          const option = document.createElement('option');
          option.value = session.session_key;
          
          // Traduire le nom de la session
          const sessionName = SESSION_TYPES[session.session_name] || session.session_name;
          const sessionDate = new Date(session.date_start).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          option.textContent = `${sessionName} - ${sessionDate}`;
          option.dataset.sessionType = session.session_name;
          sessionSelect.appendChild(option);
        });
        
        sessionSelect.disabled = false;
      } catch (error) {
        console.error("Erreur de chargement des sessions:", error);
        sessionSelect.innerHTML = '<option value="">Erreur de chargement</option>';
        showError("Impossible de charger les sessions");
      }
    }

    async function fetchStandings() {
      const container = document.getElementById('standings-content');
      
      if (!currentSessionKey) {
        showError("Veuillez sélectionner une session");
        return;
      }
      
      container.innerHTML = `
        <div class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          Chargement du classement...
        </div>
      `;
      
      try {
        await delayIfNeeded();
        
        // Récupérer les positions
        const response = await fetch(`${API_BASE_URL}/position?session_key=${currentSessionKey}`);
        
        if (!response.ok) {
          if (response.status === 429) {
            showApiWarning();
            container.innerHTML = '<div class="no-data">Limite API atteinte. Veuillez réessayer plus tard.</div>';
            return;
          }
          throw new Error(`Erreur HTTP! statut: ${response.status}`);
        }
        
        const positions = await response.json();
        
        if (!Array.isArray(positions) || positions.length === 0) {
          container.innerHTML = '<div class="no-data">Aucune donnée de position disponible pour cette session.</div>';
          return;
        }
        
        displayStandings(positions);
      } catch (error) {
        console.error("Erreur de récupération des données:", error);
        container.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-circle"></i> 
            Impossible de charger les données. Veuillez réessayer.
          </div>
        `;
      }
    }

    function displayStandings(positions) {
      const container = document.getElementById('standings-content');
      const meetingSelect = document.getElementById('meeting-select');
      const sessionSelect = document.getElementById('session-select');
      
      // Récupérer les noms du GP et de la session
      const selectedMeeting = meetingSelect.options[meetingSelect.selectedIndex];
      const selectedSession = sessionSelect.options[sessionSelect.selectedIndex];
      const sessionType = selectedSession.dataset.sessionType || 'Session';
      
      // Trier les positions par date (plus récent en premier)
      positions.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Grouper par pilote et garder la dernière position
      const latestPositions = {};
      positions.forEach(pos => {
        if (!latestPositions[pos.driver_number] || 
            new Date(pos.date) > new Date(latestPositions[pos.driver_number].date)) {
          latestPositions[pos.driver_number] = pos;
        }
      });
      
      // Convertir en tableau et trier par position
      const standings = Object.values(latestPositions)
        .sort((a, b) => a.position - b.position);
      
      // Créer le tableau HTML
      let html = `
        <div class="session-header">
          <h2 class="session-title">${selectedMeeting.textContent} - ${SESSION_TYPES[sessionType] || sessionType}</h2>
          <div class="session-info">
            Dernière mise à jour: ${new Date().toLocaleTimeString('fr-FR')}
            ${usingLocalData ? ' (données locales)' : ''}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Pilote</th>
              <th>Équipe</th>
              <th>Temps</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      standings.forEach((pos, index) => {
        const driverInfo = driversData[pos.driver_number] || {
          name: `Pilote #${pos.driver_number}`,
          team: "Inconnu",
          teamKey: 'inconnu'
        };
        
        const teamColor = teamsData[driverInfo.teamKey]?.color || '#777';
        
        html += `
          <tr>
            <td class="position-${pos.position}">${pos.position}</td>
            <td>
              <div style="display: flex; align-items: center;">
                <span class="driver-number">${pos.driver_number}</span>
                <div>
                  <div class="driver-name">${driverInfo.name}</div>
                  <div class="team-name">${driverInfo.team}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center;">
                <span class="team-color" style="background-color: ${teamColor};"></span>
                ${driverInfo.team}
              </div>
            </td>
            <td>
              ${pos.time ? formatTime(pos.time) : '--:--.---'}
            </td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
      
      container.innerHTML = html;
    }

    function formatTime(time) {
      if (!time) return '--:--.---';
      
      // Si le temps est en secondes (float)
      if (typeof time === 'number') {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const milliseconds = Math.floor((time % 1) * 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
      }
      
      // Si le temps est déjà formaté
      return time;
    }

    function showError(message) {
      const container = document.getElementById('standings-content');
      container.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle"></i> 
          ${message}
        </div>
      `;
    }
    async function fetchStandings() {
      const container = document.getElementById('standings-content');
      
      if (!currentSessionKey) {
        showError("Veuillez sélectionner une session");
        return;
      }
      
      container.innerHTML = `
        <div class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          Chargement du classement...
        </div>
      `;
      
      try {
        await delayIfNeeded();
        
        // Récupérer les positions ET les intervalles
        const [positionsResponse, intervalsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/position?session_key=${currentSessionKey}`),
          fetch(`${API_BASE_URL}/intervals?session_key=${currentSessionKey}`)
        ]);
        
        if (!positionsResponse.ok || !intervalsResponse.ok) {
          if (positionsResponse.status === 429 || intervalsResponse.status === 429) {
            showApiWarning();
            container.innerHTML = '<div class="no-data">Limite API atteinte. Veuillez réessayer plus tard.</div>';
            return;
          }
          throw new Error(`Erreur HTTP! statut: ${positionsResponse.status}/${intervalsResponse.status}`);
        }
        
        const positions = await positionsResponse.json();
        const intervals = await intervalsResponse.json();
        
        if (!Array.isArray(positions) || positions.length === 0) {
          container.innerHTML = '<div class="no-data">Aucune donnée de position disponible pour cette session.</div>';
          return;
        }
        
        displayStandings(positions, intervals);
      } catch (error) {
        console.error("Erreur de récupération des données:", error);
        container.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-circle"></i> 
            Impossible de charger les données. Veuillez réessayer.
          </div>
        `;
      }
    }

    function displayStandings(positions, intervals) {
      const container = document.getElementById('standings-content');
      const meetingSelect = document.getElementById('meeting-select');
      const sessionSelect = document.getElementById('session-select');
      
      // Récupérer les noms du GP et de la session
      const selectedMeeting = meetingSelect.options[meetingSelect.selectedIndex];
      const selectedSession = sessionSelect.options[sessionSelect.selectedIndex];
      const sessionType = selectedSession.dataset.sessionType || 'Session';
      
      // Trier les positions par date (plus récent en premier)
      positions.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Grouper par pilote et garder la dernière position
      const latestPositions = {};
      positions.forEach(pos => {
        if (!latestPositions[pos.driver_number] || 
            new Date(pos.date) > new Date(latestPositions[pos.driver_number].date)) {
          latestPositions[pos.driver_number] = pos;
        }
      });
      
      // Faire de même pour les intervalles
      const latestIntervals = {};
      intervals.forEach(int => {
        if (!latestIntervals[int.driver_number] || 
            new Date(int.date) > new Date(latestIntervals[int.driver_number].date)) {
          latestIntervals[int.driver_number] = int;
        }
      });
      
      // Convertir en tableau et trier par position
      const standings = Object.values(latestPositions)
        .sort((a, b) => a.position - b.position);
      
      // Créer le tableau HTML avec colonne d'écart
      let html = `
        <div class="session-header">
          <h2 class="session-title">${selectedMeeting.textContent} - ${SESSION_TYPES[sessionType] || sessionType}</h2>
          <div class="session-info">
            Dernière mise à jour: ${new Date().toLocaleTimeString('fr-FR')}
            ${usingLocalData ? ' (données locales)' : ''}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Pilote</th>
              <th>Équipe</th>
              <th>Temps/Écart</th>
              <th>Intervalle</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      standings.forEach((pos, index) => {
        const driverInfo = driversData[pos.driver_number] || {
          name: `Pilote #${pos.driver_number}`,
          team: "Inconnu",
          teamKey: 'inconnu'
        };
        
        const teamColor = teamsData[driverInfo.teamKey]?.color || '#777';
        const intervalData = latestIntervals[pos.driver_number];
        
        // Calculer les écarts
        let gapToLeader = '';
        let intervalToAhead = '';
        
        if (index === 0) {
          // Leader
          gapToLeader = `<span class="gap gap-leader">Leader</span>`;
          intervalToAhead = '';
        } else {
          // Écart avec le leader
          if (intervalData && intervalData.gap_to_leader) {
            gapToLeader = formatGapDisplay(intervalData.gap_to_leader);
          } else {
            gapToLeader = '<span class="gap">--</span>';
          }
          
          // Intervalle avec le pilote précédent
          if (intervalData && intervalData.interval) {
            intervalToAhead = formatGapDisplay(intervalData.interval);
          } else {
            intervalToAhead = '<span class="interval">--</span>';
          }
        }
        
        html += `
          <tr>
            <td class="position-${pos.position}">${pos.position}</td>
            <td>
              <div style="display: flex; align-items: center;">
                <span class="driver-number">${pos.driver_number}</span>
                <div>
                  <div class="driver-name">${driverInfo.name}</div>
                  <div class="team-name">${driverInfo.team}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center;">
                <span class="team-color" style="background-color: ${teamColor};"></span>
                ${driverInfo.team}
              </div>
            </td>
            <td>
              ${pos.time ? formatTime(pos.time) : gapToLeader}
            </td>
            <td>
              ${intervalToAhead}
            </td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
      
      container.innerHTML = html;
    }

    function formatGapDisplay(gap) {
      if (gap === '+1 LAP' || gap === '+1 LAP') {
        return '<span class="gap">+1 TOUR</span>';
      }
      
      if (typeof gap === 'number') {
        return `<span class="gap">+${gap.toFixed(3)}s</span>`;
      }
      
      return '<span class="gap">--</span>';
    }