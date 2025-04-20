console.log("Script chargé !"); // Vérifier dans la console

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM prêt !")
})


const API_BASE_URL = "https://api.openf1.org/v1/team_radio";
    const SESSIONS_API_URL = "https://api.openf1.org/v1/sessions?year=2025";
    const LIVE_SESSION_URL = "https://api.openf1.org/v1/live/session";
    const CACHE_DURATION = 5 * 60 * 1000;
    let currentSessionKey = null;
    let refreshInterval = null;

    // Pilotes F1 2025 avec leurs numéros et équipes
    const DRIVERS = {
      1: { name: "Max Verstappen", team: "Red Bull Racing", color: "var(--team-redbull)" },
      4: { name: "Lando Norris", team: "McLaren", color: "var(--team-mclaren)" },
      5: { name: "Gabriel Bortoleto", team: "Sauber", color: "var(--team-sauber)" },
      6: { name: "Isack Hadjar", team: "Racing Bulls", color: "var(--team-racingbulls)" },
      7: { name: "Jack Doohan", team: "Alpine", color: "var(--team-alpine)" },
      10: { name: "Pierre Gasly", team: "Alpine", color: "var(--team-alpine)" },
      12: { name: "Andrea Kimi Antonelli", team: "Mercedes", color: "var(--team-mercedes)" },
      14: { name: "Fernando Alonso", team: "Aston Martin", color: "var(--team-aston)" },
      16: { name: "Charles Leclerc", team: "Ferrari", color: "var(--team-ferrari)" },
      18: { name: "Lance Stroll", team: "Aston Martin", color: "var(--team-aston)" },
      22: { name: "Yuki Tsunoda", team: "AlphaTauri", color: "var(--team-racingbulls)" },
      23: { name: "Alexander Albon", team: "Williams", color: "var(--team-williams)" },
      27: { name: "Nico Hülkenberg", team: "Sauber", color: "var(--team-sauber)" },
      30: { name: "Liam Lawson", team: "Racing Bulls", color: "var(--team-racingbulls)" },
      31: { name: "Esteban Ocon", team: "Haas", color: "var(--team-haas)" },
      44: { name: "Lewis Hamilton", team: "Ferrari", color: "var(--team-ferrari)" },
      55: { name: "Carlos Sainz", team: "Ferrari", color: "var(--team-ferrari)" },
      63: { name: "George Russell", team: "Mercedes", color: "var(--team-mercedes)" },
      81: { name: "Oscar Piastri", team: "McLaren", color: "var(--team-mclaren)" },
      87: { name: "Oliver Bearman", team: "Haas", color: "var(--team-haas)" }
    };

    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
    });

    async function initializeApp() {
      try {
        await fetchSessions();
        document.getElementById('session-selector').addEventListener('change', handleSessionChange);
        document.getElementById('refresh-btn').addEventListener('click', handleRefresh);
      } catch (error) {
        console.error("Initialization error:", error);
        showError("Erreur d'initialisation de l'application");
      }
    }

    function formatSessionType(type) {
      const types = {
        "Race": "Course",
        "Qualifying": "Qualifications",
        "Sprint": "Sprint",
        "Practice 1": "Essais Libres 1",
        "Practice 2": "Essais Libres 2",
        "Practice 3": "Essais Libres 3",
        "Sprint Qualifying": "Qualifications Sprint"
      };
      return types[type] || type;
    }

    async function fetchSessions() {
      const selector = document.getElementById("session-selector");
      selector.innerHTML = '<option value="">Chargement en cours...</option>';
      
      try {
        console.log("Fetching sessions from:", SESSIONS_API_URL);
        const response = await fetch(SESSIONS_API_URL);
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        const sessions = await response.json();
        console.log("Sessions reçues:", sessions);
        
        if (!Array.isArray(sessions)) {
          throw new Error("Format de données invalide");
        }

        if (sessions.length === 0) {
          console.warn("Aucune session disponible");
          selector.innerHTML = '<option value="">Aucune session disponible</option>';
          return;
        }
        
        setupSessionSelector(sessions);
      } catch (error) {
        console.error("Erreur fetchSessions:", error);
        selector.innerHTML = '<option value="">Erreur de chargement</option>';
        showError(`Erreur: ${error.message}`);
      }
    }

    function setupSessionSelector(sessions) {
      const selector = document.getElementById("session-selector");
      selector.innerHTML = '<option value="">Sélectionnez une session</option>';

      // Filtrer seulement les sessions valides avec session_key et session_name
      const validSessions = sessions.filter(session => {
        return session.session_key && session.session_name;
      });

      if (validSessions.length === 0) {
        console.warn("Aucune session valide trouvée");
        selector.innerHTML = '<option value="">Aucune session disponible</option>';
        return;
      }

      // Trier par date (plus récent en premier)
      validSessions.sort((a, b) => new Date(b.date_start || b.start_date) - new Date(a.date_start || a.start_date));

      // Grouper par meeting
      const meetings = {};
      validSessions.forEach(session => {
        const meetingKey = session.meeting_key || session.meeting_name;
        if (!meetings[meetingKey]) {
          meetings[meetingKey] = {
            name: session.meeting?.official_name || session.meeting_name || "Grand Prix",
            sessions: []
          };
        }
        meetings[meetingKey].sessions.push(session);
      });

      // Créer des groupes pour chaque meeting
      Object.values(meetings).forEach(meeting => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = meeting.name;
        
        meeting.sessions.forEach(session => {
          const option = document.createElement("option");
          option.value = session.session_key;
          
          const sessionDate = new Date(session.date_start || session.start_date);
          const dateStr = sessionDate.toLocaleDateString('fr-FR');
          const timeStr = sessionDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
          const sessionType = formatSessionType(session.session_type || session.session_name);
          
          option.textContent = `${sessionType} (${dateStr} ${timeStr})`;
          optgroup.appendChild(option);
        });
        
        selector.appendChild(optgroup);
      });

      // Sélectionner la première session
      selector.value = validSessions[0].session_key;
      fetchTeamRadio(validSessions[0].session_key);
    }

    async function handleSessionChange(event) {
      const sessionKey = event.target.value;
      if (!sessionKey) return;
      
      currentSessionKey = sessionKey;
      
      // Arrêter le rafraîchissement précédent
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      
      // Vérifier si c'est une session en direct
      const isLive = event.target.selectedOptions[0].dataset.live === "true";
      await fetchTeamRadio(sessionKey, isLive);
      
      // Si session en direct, activer le rafraîchissement automatique
      if (isLive) {
        refreshInterval = setInterval(() => fetchTeamRadio(sessionKey, true), 10000);
      }
    }

    async function handleRefresh() {
      if (currentSessionKey) {
        const selector = document.getElementById("session-selector");
        const isLive = selector.selectedOptions[0]?.dataset.live === "true";
        await fetchTeamRadio(currentSessionKey, isLive);
      }
    }

    async function fetchTeamRadio(sessionKey, isLive = false) {
      const container = document.getElementById("radio-container");
      container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement des radios...</div>';
      
      try {
        const url = `${API_BASE_URL}?session_key=${sessionKey}${isLive ? "&order=desc" : ""}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        
        const radios = await response.json();
        console.log("Radios reçues:", radios);
        
        if (!Array.isArray(radios) || radios.length === 0) {
          container.innerHTML = '<p class="no-radios">Aucune communication radio disponible pour cette session.</p>';
          return;
        }
        
        displayTeamRadio(radios, isLive);
      } catch (error) {
        console.error("Erreur fetchTeamRadio:", error);
        container.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Impossible de charger les radios. Veuillez réessayer.</div>';
      }
    }

    function displayTeamRadio(radios, isLive = false) {
      const container = document.getElementById("radio-container");
      container.innerHTML = '';
      
      if (isLive) {
        const liveHeader = document.createElement("div");
        liveHeader.className = "radio-header";
        liveHeader.innerHTML = `
          <span class="radio-driver">Session en direct <span class="live-badge">LIVE</span></span>
        `;
        container.appendChild(liveHeader);
      }
      
      // Trier toutes les radios par date (plus récent en haut)
      radios.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Créer un seul conteneur pour toutes les radios
      const radiosContainer = document.createElement("div");
      radiosContainer.className = "radio-container";
      
      // Afficher toutes les radios dans l'ordre chronologique
      radios.forEach(radio => {
        const driverNumber = radio.driver_number;
        const driverInfo = DRIVERS[driverNumber] || {
          name: `Pilote #${driverNumber}`,
          team: "",
          color: "var(--f1-gray)"
        };
        
        const radioTime = new Date(radio.date);
        const timeStr = radioTime.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        const radioElement = document.createElement("div");
        radioElement.className = "radio-item";
        radioElement.style.borderLeftColor = driverInfo.color;
        
        radioElement.innerHTML = `
          <div class="radio-header">
            <div>
              <div class="radio-driver">
                <span class="driver-number">${driverNumber}</span>
                ${driverInfo.name}
              </div>
              ${driverInfo.team ? `<div class="team-name">${driverInfo.team}</div>` : ''}
            </div>
            <span class="radio-time">${timeStr}</span>
          </div>
          <audio controls src="${radio.recording_url}">
            Votre navigateur ne supporte pas l'élément audio.
          </audio>
        `;
        radiosContainer.appendChild(radioElement);
      });
      
      container.appendChild(radiosContainer);
    }

    function showError(message) {
      const container = document.getElementById("radio-container");
      container.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${message}</div>`;
    }