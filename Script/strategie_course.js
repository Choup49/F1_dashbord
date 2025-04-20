 // Configuration de l'API
    const API_BASE_URL = "https://api.openf1.org/v1";
    const CURRENT_YEAR = new Date().getFullYear();
    
    // Variables globales
    let currentSessionKey = null;
    let currentMeetingKey = null;
    let driversData = {};
    let strategiesData = {};

    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
    });

    async function initializeApp() {
      try {
        await loadMeetings();
        setupEventListeners();
      } catch (error) {
        console.error("Erreur d'initialisation:", error);
        showError("Erreur lors du chargement de l'application");
      }
    }

    function setupEventListeners() {
      document.getElementById('meeting-select').addEventListener('change', loadSessionsForMeeting);
      document.getElementById('session-select').addEventListener('change', handleSessionChange);
      document.getElementById('refresh-btn').addEventListener('click', handleRefresh);
      
      // Boutons de tri
      document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          if (currentSessionKey) {
            updateStrategies();
          }
        });
      });
    }

    async function loadMeetings() {
      const meetingSelect = document.getElementById('meeting-select');
      meetingSelect.innerHTML = '<option value="">Chargement...</option>';
      
      try {
        const response = await fetch(`${API_BASE_URL}/meetings?year=${CURRENT_YEAR}`);
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        const meetings = await response.json();
        
        if (!Array.isArray(meetings) || meetings.length === 0) {
          meetingSelect.innerHTML = '<option value="">Aucun GP disponible</option>';
          return;
        }

        // Trier par date (plus récent en premier)
        meetings.sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

        meetingSelect.innerHTML = '<option value="">Sélectionnez un Grand Prix</option>';
        meetings.forEach(meeting => {
          const option = document.createElement('option');
          option.value = meeting.meeting_key;
          option.textContent = meeting.meeting_name;
          meetingSelect.appendChild(option);
        });
      } catch (error) {
        console.error("Erreur de chargement des meetings:", error);
        meetingSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      }
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
        const response = await fetch(`${API_BASE_URL}/sessions?meeting_key=${currentMeetingKey}`);
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
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
          option.textContent = `${formatSessionName(session.session_name)} - ${new Date(session.date_start).toLocaleDateString('fr-FR')}`;
          sessionSelect.appendChild(option);
        });
        
        sessionSelect.disabled = false;
      } catch (error) {
        console.error("Erreur de chargement des sessions:", error);
        sessionSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      }
    }

    function formatSessionName(sessionType) {
      const types = {
        "Practice 1": "EL1",
        "Practice 2": "EL2",
        "Practice 3": "EL3",
        "Qualifying": "Qualifs",
        "Sprint Qualifying": "Qualifs Sprint",
        "Sprint": "Sprint",
        "Race": "Course"
      };
      return types[sessionType] || sessionType;
    }

    async function handleSessionChange(event) {
      const sessionKey = event.target.value;
      if (!sessionKey) return;
      
      currentSessionKey = sessionKey;
      await updateStrategies();
    }

    async function handleRefresh() {
      if (currentSessionKey) {
        await updateStrategies();
      }
    }

    async function updateStrategies() {
      const container = document.getElementById('strategies-container');
      container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement des stratégies...</div>';
      
      try {
        // Récupérer les données nécessaires
        const [stintsResponse, driversResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/stints?session_key=${currentSessionKey}`),
          fetch(`${API_BASE_URL}/drivers?session_key=${currentSessionKey}`)
        ]);
        
        if (!stintsResponse.ok || !driversResponse.ok) {
          throw new Error(`Erreur HTTP: ${stintsResponse.status}/${driversResponse.status}`);
        }
        
        const stints = await stintsResponse.json();
        const drivers = await driversResponse.json();
        
        // Organiser les données des pilotes
        driversData = {};
        drivers.forEach(driver => {
          driversData[driver.driver_number] = {
            name: driver.full_name,
            team: driver.team_name,
            headshot: driver.headshot_url
          };
        });
        
        // Grouper les relais par pilote
        strategiesData = {};
        stints.forEach(stint => {
          if (!strategiesData[stint.driver_number]) {
            strategiesData[stint.driver_number] = [];
          }
          strategiesData[stint.driver_number].push(stint);
        });
        
        // Trier les relais par pilote
        const sortedDriverNumbers = sortStrategies(strategiesData);
        
        // Afficher les stratégies
        displayStrategies(sortedDriverNumbers, strategiesData);
      } catch (error) {
        console.error("Erreur de chargement des stratégies:", error);
        container.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Impossible de charger les stratégies. Veuillez réessayer.</div>';
      }
    }

    function sortStrategies(strategies) {
      const sortMethod = document.querySelector('.sort-btn.active').dataset.sort;
      const driverNumbers = Object.keys(strategies);
      
      if (sortMethod === 'driver') {
        // Trier par nom de pilote
        return driverNumbers.sort((a, b) => {
          const nameA = driversData[a]?.name || `Pilote ${a}`;
          const nameB = driversData[b]?.name || `Pilote ${b}`;
          return nameA.localeCompare(nameB);
        });
      } else if (sortMethod === 'stops') {
        // Trier par nombre d'arrêts (décroissant)
        return driverNumbers.sort((a, b) => {
          return strategies[b].length - strategies[a].length;
        });
      }
      
      return driverNumbers;
    }

    function displayStrategies(sortedDriverNumbers, strategies) {
      const container = document.getElementById('strategies-container');
      
      if (sortedDriverNumbers.length === 0) {
        container.innerHTML = '<p>Aucune donnée de stratégie disponible pour cette session.</p>';
        return;
      }
      
      let html = '';
      
      sortedDriverNumbers.forEach(driverNumber => {
        const stints = strategies[driverNumber];
        const driverInfo = driversData[driverNumber] || {
          name: `Pilote ${driverNumber}`,
          team: 'Inconnu'
        };
        
        // Trier les relais par ordre chronologique
        stints.sort((a, b) => a.lap_start - b.lap_start);
        
        html += `
          <div class="driver-strategy">
            <div class="driver-header">
              <div class="driver-number">${driverNumber}</div>
              <div class="driver-name">${driverInfo.name}</div>
              <div class="team-name">${driverInfo.team}</div>
            </div>
            <div class="strategy-timeline">
        `;
        
        stints.forEach((stint, index) => {
          const laps = stint.lap_end - stint.lap_start + 1;
          const tyreClass = getTyreClass(stint.compound);
          const tyreName = getTyreName(stint.compound);
          
          html += `
            <div class="stint">
              <div class="stint-info">
                <div class="stint-laps">${laps} tours</div>
                <div>Tours ${stint.lap_start}-${stint.lap_end}</div>
              </div>
              <div class="stint-tyre ${tyreClass}" title="${tyreName} - ${laps} tours (${stint.lap_start}-${stint.lap_end})">
                ${tyreName}
              </div>
              <div class="stint-details">
                Pneus âgés de ${stint.tyre_age_at_start} tours au départ
              </div>
            </div>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    }

    function getTyreClass(compound) {
      if (!compound) return 'unknown';
      
      const lowerCompound = compound.toLowerCase();
      if (lowerCompound.includes('soft')) return 'soft';
      if (lowerCompound.includes('medium')) return 'medium';
      if (lowerCompound.includes('hard')) return 'hard';
      if (lowerCompound.includes('inter')) return 'inter';
      if (lowerCompound.includes('wet')) return 'wet';
      return 'unknown';
    }

    function getTyreName(compound) {
      if (!compound) return 'Inconnu';
      
      const lowerCompound = compound.toLowerCase();
      if (lowerCompound.includes('soft')) return 'Soft';
      if (lowerCompound.includes('medium')) return 'Medium';
      if (lowerCompound.includes('hard')) return 'Hard';
      if (lowerCompound.includes('inter')) return 'Intermediate';
      if (lowerCompound.includes('wet')) return 'Wet';
      return compound;
    }

    function showError(message) {
      const container = document.getElementById('strategies-container');
      container.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle"></i> 
          ${message}
        </div>
      `;
    }