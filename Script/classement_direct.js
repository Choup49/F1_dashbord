// ==============================================
        // Configuration et constantes
        // ==============================================
        const REFRESH_INTERVAL = 30000; // 30 secondes
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes en ms
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000; // 2 secondes entre les tentatives

        // ==============================================
        // État global de l'application
        // ==============================================
        const state = {
            driversData: {},
            bestSectors: { s1: null, s2: null, s3: null },
            lastUpdate: null,
            currentSessionKey: null,
            currentSessionData: null,
            refreshIntervalId: null,
            previousPositions: {},
            positionChanges: {},
            countryCodes: {
                'albon': 'th',
                'alonso': 'es',
                'bottas': 'fi',
                'gasly': 'fr',
                'hamilton': 'gb',
                'hulkenberg': 'de',
                'leclerc': 'mc',
                'kevin_magnussen': 'dk',
                'norris': 'gb',
                'ocon': 'fr',
                'perez': 'mx',
                'piastri': 'au',
                'ricciardo': 'au',
                'russell': 'gb',
                'sainz': 'es',
                'sargeant': 'us',
                'stroll': 'ca',
                'tsunoda': 'jp',
                'max_verstappen': 'nl',
                'zhou': 'cn'
            }
        };

        // ==============================================
        // Fonctions utilitaires
        // ==============================================

        function showError(message) {
            const oldError = document.querySelector('.error-message');
            if (oldError) oldError.remove();
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            document.querySelector('.controls').appendChild(errorDiv);
        }

        function showNotification(message) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 5000);
        }

        function showLoading() {
            const tableBody = document.getElementById('ranking-body');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading">
                        <div class="spinner" aria-hidden="true"></div>
                        Chargement des données...
                    </td>
                </tr>
            `;
        }

        function formatTime(seconds) {
            if (seconds === null || seconds === undefined) return '-';
            if (seconds < 0.001) return '0.000';
            
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            return minutes > 0 
                ? `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}` 
                : remainingSeconds.toFixed(3);
        }

        function appendCell(row, text, className = '') {
            const cell = document.createElement('td');
            cell.textContent = text;
            if (className) cell.className = className;
            row.appendChild(cell);
        }

        function detectPositionChanges(currentPositions) {
            for (const [driverNumber, position] of Object.entries(currentPositions)) {
                if (state.previousPositions[driverNumber] && state.previousPositions[driverNumber] !== position) {
                    state.positionChanges[driverNumber] = true;
                }
            }
        }

        async function fetchWithCache(url, options = {}) {
            const cacheKey = `f1-cache-${url}`;
            const cached = localStorage.getItem(cacheKey);
            const now = Date.now();
            
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (now - timestamp < CACHE_TTL) {
                    return data;
                }
            }
            
            try {
                const response = await fetch(url, options);
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                
                const data = await response.json();
                
                localStorage.setItem(cacheKey, JSON.stringify({
                    data,
                    timestamp: now
                }));
                
                return data;
            } catch (error) {
                if (cached) {
                    console.warn('Utilisation des données en cache suite à une erreur:', error);
                    return JSON.parse(cached).data;
                }
                throw error;
            }
        }

        async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
            try {
                return await fetchWithCache(url);
            } catch (error) {
                if (retries > 0) {
                    console.warn(`Tentative ${MAX_RETRIES - retries + 1} échouée, nouvelle tentative dans ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return fetchWithRetry(url, retries - 1, delay);
                }
                throw error;
            }
        }

        function isSessionLive(sessionEndTime) {
            if (!sessionEndTime) return false;
            const now = new Date();
            const endTime = new Date(sessionEndTime);
            return now < endTime;
        }

        // ==============================================
        // Fonctions de gestion des données
        // ==============================================

        function addDataWarningIfNeeded(dataStatus, tableBody) {
            const missingData = [];
            
            if (!dataStatus.hasSectorTimes) {
                missingData.push('sectorielles');
            }
            
            if (!dataStatus.hasGapData && !dataStatus.hasCalculableGaps) {
                missingData.push("d'écart");
            }
            
            if (missingData.length > 0) {
                const warningRow = document.createElement('tr');
                const warningCell = document.createElement('td');
                warningCell.colSpan = 8;
                warningCell.className = 'error-message';
                
                if (missingData.length === 2) {
                    warningCell.textContent = 'Les données sectorielles et les écarts ne sont pas disponibles pour cette session.';
                } else {
                    warningCell.textContent = `Les données ${missingData.join(' et ')} ne sont pas disponibles pour cette session.`;
                }
                
                // Ajouter des conseils spécifiques
                const advice = document.createElement('div');
                advice.style.marginTop = '8px';
                advice.textContent = 'Conseil : Essayez une session de qualification ou de course pour des données plus complètes.';
                warningCell.appendChild(advice);
                
                warningRow.appendChild(warningCell);
                tableBody.appendChild(warningRow);
            }
        }

        function analyzeDataAvailability() {
    const driversArray = Object.values(state.driversData);
    
    return {
        hasSectorTimes: driversArray.some(driver => 
            driver.sectors && (driver.sectors.s1 || driver.sectors.s2 || driver.sectors.s3)
        ),
        hasFullSectorTimes: driversArray.some(driver => 
            driver.sectors && driver.sectors.s1 && driver.sectors.s2 && driver.sectors.s3
        ),
        hasGapData: driversArray.some(driver => 
            driver.gapToLeader !== undefined || driver.interval !== undefined
        ),
        hasTotalTime: driversArray.some(driver => 
            driver.totalTime
        ),
        hasCalculableGaps: driversArray.length > 1 && 
            driversArray[0].totalTime && driversArray[1].totalTime
    };
}

        function updateDataStatusDisplay(dataStatus) {
            const statusElement = document.getElementById('data-status');
            let statusText = '';
            
            if (!dataStatus.hasSectorTimes && !dataStatus.hasGapData) {
                statusText = 'Données limitées disponibles';
            } else if (!dataStatus.hasFullSectorTimes) {
                statusText = 'Données sectorielles partielles';
            }
            
            statusElement.textContent = statusText;
        }

        // ==============================================
        // Fonctions de création des éléments UI
        // ==============================================

        function createDriverRow(driver, isLiveSession, dataStatus) {
            const row = document.createElement('tr');
            
            if (isLiveSession && state.previousPositions[driver.driverNumber] && 
                state.previousPositions[driver.driverNumber] !== driver.position) {
                row.classList.add('position-change');
            }
            
            // Position
            appendCell(row, driver.position);
            
            // Pilote
            const driverCell = document.createElement('td');
            const flagClass = state.countryCodes[driver.lastName.toLowerCase()] || 'unknown';
            driverCell.innerHTML = `
                <span class="flag-icon flag-icon-${flagClass} driver-flag" title="${flagClass.toUpperCase()}"></span>
                ${driver.fullName}
            `;
            row.appendChild(driverCell);
            
            // Numéro
            appendCell(row, driver.driverNumber);
            
            // Temps total
            row.appendChild(createTotalTimeCell(driver, dataStatus));
            
            // Écart
            row.appendChild(createGapCell(driver, dataStatus));
            
            // Secteurs
            row.appendChild(createSectorCell(driver, 's1', isLiveSession, dataStatus.hasSectorTimes));
            row.appendChild(createSectorCell(driver, 's2', isLiveSession, dataStatus.hasSectorTimes));
            row.appendChild(createSectorCell(driver, 's3', isLiveSession, dataStatus.hasSectorTimes));
            
            return row;
        }

        function createTotalTimeCell(driver, dataStatus) {
            const cell = document.createElement('td');
            
            if (driver.totalTime) {
                cell.textContent = formatTime(driver.totalTime);
            } else if (driver.sectors && driver.sectors.s1 && driver.sectors.s2 && driver.sectors.s3) {
                const totalTime = driver.sectors.s1 + driver.sectors.s2 + driver.sectors.s3;
                cell.textContent = formatTime(totalTime);
            } else {
                cell.textContent = '-';
                cell.className = 'data-unavailable';
            }
            
            return cell;
        }

        function createGapCell(driver, dataStatus) {
    const cell = document.createElement('td');
    
    if (driver.position === 1) {
        cell.textContent = '';
    } 
    else if (driver.gapToLeader !== undefined && driver.gapToLeader !== null) {
        const gap = typeof driver.gapToLeader === 'number' ? driver.gapToLeader : parseFloat(driver.gapToLeader);
        cell.textContent = gap > 0 ? `+${gap.toFixed(3)}` : gap.toFixed(3);
        cell.className = 'gap';
        cell.title = "Écart avec le leader";
    } 
    else if (driver.interval !== undefined && driver.interval !== null) {
        const interval = typeof driver.interval === 'number' ? driver.interval : parseFloat(driver.interval);
        cell.textContent = interval > 0 ? `+${interval.toFixed(3)}` : interval.toFixed(3);
        cell.className = 'gap';
        cell.title = "Écart avec le pilote précédent";
    } 
    else if (dataStatus.hasCalculableGaps && driver.totalTime && state.driversData[1]?.totalTime) {
        const gap = driver.totalTime - state.driversData[1].totalTime;
        cell.textContent = `+${gap.toFixed(3)}`;
        cell.className = 'gap';
        cell.title = "Écart calculé à partir des temps totaux";
    }
    else {
        cell.textContent = '+---';
        cell.className = 'gap data-unavailable';
        cell.title = "Donnée d'écart non disponible";
    }
    
    return cell;
}

        function createSectorCell(driver, sector, isLiveSession, hasSectorTimes) {
            const cell = document.createElement('td');
            
            if (driver.sectors && driver.sectors[sector]) {
                cell.textContent = formatTime(driver.sectors[sector]);
                
                // Mise en évidence des meilleurs secteurs
                if (state.bestSectors[sector] && Math.abs(driver.sectors[sector] - state.bestSectors[sector]) < 0.001) {
                    cell.classList.add('best-sector');
                    cell.title = 'Meilleur secteur de la session';
                } 
                // Mise en évidence des améliorations
                else if (isLiveSession && driver.previousSectors && driver.previousSectors[sector] && 
                        driver.sectors[sector] < driver.previousSectors[sector]) {
                    cell.classList.add('improved-sector');
                    cell.title = `Amélioré de ${(driver.previousSectors[sector] - driver.sectors[sector]).toFixed(3)}s`;
                } 
                // Mise en évidence des pertes de temps
                else if (isLiveSession && driver.previousSectors && driver.previousSectors[sector]) {
                    cell.classList.add('worse-sector');
                    cell.title = `Perdu ${(driver.sectors[sector] - driver.previousSectors[sector]).toFixed(3)}s`;
                }
            } else {
                cell.textContent = '-';
                if (hasSectorTimes) {
                    cell.className = 'data-unavailable';
                    cell.title = 'Donnée sectorielle non disponible';
                }
            }
            
            return cell;
        }

        function updateUI(isLiveSession = false) {
            const tableBody = document.getElementById('ranking-body');
            
            if (Object.keys(state.driversData).length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="loading">
                            <div class="spinner" aria-hidden="true"></div>
                            Aucune donnée disponible pour cette session
                        </td>
                    </tr>
                `;
                return;
            }

            const dataStatus = analyzeDataAvailability();
            updateDataStatusDisplay(dataStatus);

            const fragment = document.createDocumentFragment();
            const driversArray = Object.values(state.driversData).sort((a, b) => a.position - b.position);

            driversArray.forEach(driver => {
                const row = createDriverRow(driver, isLiveSession, dataStatus);
                fragment.appendChild(row);
            });

            tableBody.innerHTML = '';
            tableBody.appendChild(fragment);

            addDataWarningIfNeeded(dataStatus, tableBody);
        }

        // ==============================================
        // Fonctions de traitement des données
        // ==============================================

        function processLiveData(positionData, driversInfo, intervalsData, sectorsData) {
            console.group("Processing Live Data");
            console.log("Position Data:", positionData);
            console.log("Drivers Info:", driversInfo);
            console.log("Intervals Data:", intervalsData);
            console.log("Sectors Data:", sectorsData);
            
            // Vérification des données minimales
            if (!positionData || positionData.length === 0) {
                console.error("Aucune donnée de position disponible");
                console.groupEnd();
                return;
            }

            // Traitement des positions
            const currentPositions = {};
            positionData.forEach(pos => {
                currentPositions[pos.driver_number] = pos.position;
                console.log(`Pilote ${pos.driver_number}: Position ${pos.position}`);
            });

            // Traitement des secteurs
            state.bestSectors = { s1: null, s2: null, s3: null };
            if (sectorsData && sectorsData.length > 0) {
                console.log(`${sectorsData.length} données sectorières trouvées`);
                sectorsData.forEach(sector => {
                    const sectorKey = `s${sector.sector}`;
                    if (!state.bestSectors[sectorKey] || sector.sector_time < state.bestSectors[sectorKey]) {
                        state.bestSectors[sectorKey] = sector.sector_time;
                        console.log(`Nouveau meilleur secteur ${sectorKey}: ${sector.sector_time}s par le pilote ${sector.driver_number}`);
                    }
                });
            } else {
                console.warn("Aucune donnée sectorière disponible");
            }

            // Traitement des intervalles
            const latestIntervals = {};
            if (intervalsData && intervalsData.length > 0) {
                console.log(`${intervalsData.length} intervalles trouvés`);
                intervalsData.forEach(interval => {
                    if (!latestIntervals[interval.driver_number] || 
                        new Date(interval.date) > new Date(latestIntervals[interval.driver_number].date)) {
                        latestIntervals[interval.driver_number] = interval;
                        console.log(`Intervalle pour ${interval.driver_number}: ${interval.gap_to_leader}s`);
                    }
                });
            } else {
                console.warn("Aucune donnée d'intervalle disponible");
            }

            // Construction des données pilotes
            positionData.forEach(position => {
                const driverNumber = position.driver_number;
                const driverInfo = driversInfo.find(d => d.driver_number === driverNumber) || {};
                
                const driverSectors = {};
                if (sectorsData) {
                    sectorsData
                        .filter(s => s.driver_number === driverNumber)
                        .forEach(sector => {
                            const sectorKey = `s${sector.sector}`;
                            if (!driverSectors[sectorKey] || new Date(sector.date) > new Date(driverSectors[sectorKey].date)) {
                                driverSectors[sectorKey] = {
                                    time: sector.sector_time,
                                    date: sector.date
                                };
                            }
                        });
                }
                
                const intervalData = latestIntervals[driverNumber] || {};
                
                state.driversData[driverNumber] = {
                    position: position.position,
                    driverNumber: driverNumber,
                    firstName: driverInfo.first_name || 'Inconnu',
                    lastName: driverInfo.last_name || 'Inconnu',
                    fullName: `${driverInfo.first_name || 'Inconnu'} ${driverInfo.last_name || 'Inconnu'}`,
                    gapToLeader: intervalData.gap_to_leader,
                    interval: intervalData.interval,
                    totalTime: position.lap_time,
                    sectors: {
                        s1: driverSectors.s1?.time,
                        s2: driverSectors.s2?.time,
                        s3: driverSectors.s3?.time
                    },
                    previousSectors: state.driversData[driverNumber]?.sectors || {}
                };
            });
            
            state.previousPositions = currentPositions;
            console.groupEnd();
        }

        function processHistoricalData(lapsData, positionData, driversInfo) {
    console.group("Processing Historical Data");
    state.bestSectors = { s1: null, s2: null, s3: null };
    state.driversData = {};
    
    if (lapsData && lapsData.length > 0) {
        console.log(`${lapsData.length} tours trouvés`);
        console.log("Exemple de données de tour:", lapsData[0]); // Debug
        
        // Trouver le meilleur tour valide pour chaque pilote
        const bestLapsByDriver = {};
        lapsData.forEach(lap => {
            // Vérifier si le tour a des données valides
            const hasValidTime = lap.lap_duration && !isNaN(lap.lap_duration);
            const driverNum = lap.driver_number;
            
            if (hasValidTime) {
                if (!bestLapsByDriver[driverNum] || 
                    lap.lap_duration < bestLapsByDriver[driverNum].lap_duration) {
                    bestLapsByDriver[driverNum] = lap;
                }
            }
        });
        
        // Convertir en array et trier par temps
        const sortedLaps = Object.values(bestLapsByDriver)
            .sort((a, b) => a.lap_duration - b.lap_duration);
        
        if (sortedLaps.length === 0) {
            console.warn("Aucun tour valide avec temps trouvé - tentative avec positionData");
            if (positionData && positionData.length > 0) {
                processLiveData(positionData, driversInfo, [], []);
            }
            console.groupEnd();
            return;
        }
        
        const leaderTime = sortedLaps[0].lap_duration;
        
        // Créer les données pilotes
        sortedLaps.forEach((lap, index) => {
            const driverInfo = driversInfo.find(d => d.driver_number === lap.driver_number) || {};
            
            // Calculer l'écart avec le leader
            const gapToLeader = index === 0 ? 0 : (lap.lap_duration - leaderTime);
            
            state.driversData[lap.driver_number] = {
                position: index + 1,
                driverNumber: lap.driver_number,
                firstName: driverInfo.first_name || 'Inconnu',
                lastName: driverInfo.last_name || 'Inconnu',
                fullName: `${driverInfo.first_name || 'Inconnu'} ${driverInfo.last_name || 'Inconnu'}`,
                gapToLeader: gapToLeader,
                interval: gapToLeader,
                totalTime: lap.lap_duration,
                sectors: {
                    s1: lap.sector1_time || null,
                    s2: lap.sector2_time || null,
                    s3: lap.sector3_time || null
                },
                previousSectors: {}
            };
            
            console.log(`Pilote ${lap.driver_number}: ${lap.lap_duration}s (écart: +${gapToLeader.toFixed(3)}s)`);
        });
        
        // Calculer les meilleurs secteurs parmi ceux disponibles
        state.bestSectors = { s1: null, s2: null, s3: null };
        sortedLaps.forEach(lap => {
            ['s1', 's2', 's3'].forEach(sector => {
                const sectorTime = lap[`sector${sector.charAt(1)}_time`];
                if (sectorTime && (!state.bestSectors[sector] || sectorTime < state.bestSectors[sector])) {
                    state.bestSectors[sector] = sectorTime;
                }
            });
        });
    } else {
        console.warn("Aucune donnée de tour disponible - tentative avec positionData");
        if (positionData && positionData.length > 0) {
            processLiveData(positionData, driversInfo, [], []);
        }
    }
    
    console.groupEnd();
}

        function calculateMissingData() {
            const drivers = Object.values(state.driversData).sort((a, b) => a.position - b.position);
            
            // Calcul des écarts si manquants
            if (drivers.length > 1 && drivers[0].totalTime) {
                drivers.forEach((driver, index) => {
                    if (index > 0 && !driver.gapToLeader && driver.totalTime) {
                        driver.gapToLeader = (driver.totalTime - drivers[0].totalTime).toFixed(3);
                        console.log(`Écart calculé pour ${driver.driverNumber}: ${driver.gapToLeader}s`);
                    }
                });
            }

            // Calcul des secteurs si manquants mais temps total disponible
            drivers.forEach(driver => {
                if (driver.totalTime && (!driver.sectors || !driver.sectors.s1)) {
                    // Répartition hypothétique des secteurs (à adapter selon le circuit)
                    driver.sectors = {
                        s1: driver.totalTime * 0.35,
                        s2: driver.totalTime * 0.40,
                        s3: driver.totalTime * 0.25
                    };
                    console.log(`Secteurs estimés pour ${driver.driverNumber}`);
                }
            });
        }

        async function fetchData(sessionKey, isLiveSession = false) {
    try {
        showLoading();
        
        // Réinitialiser les données
        state.driversData = {};
        state.bestSectors = { s1: null, s2: null, s3: null };

        const sessionData = await fetchWithRetry(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`);
        if (!sessionData || sessionData.length === 0) {
            throw new Error('Aucune donnée de session disponible');
        }

        state.currentSessionData = sessionData[0];
        document.getElementById('session-name').textContent = state.currentSessionData.session_name;

        // Endpoints prioritaires
        const endpoints = [
            `https://api.openf1.org/v1/laps?session_key=${sessionKey}`,
            `https://api.openf1.org/v1/drivers?session_key=${sessionKey}`
        ];

        const [lapsData, driversInfo] = await Promise.all(
            endpoints.map(url => 
                fetchWithRetry(url)
                    .then(data => data || [])
                    .catch(error => {
                        console.error(`Error fetching ${url}:`, error);
                        return [];
                    })
        ));

        if (isLiveSession) {
            // Charger les données supplémentaires pour les sessions en direct
            const [positionData, intervalsData, sectorsData] = await Promise.all([
                fetchWithRetry(`https://api.openf1.org/v1/position?session_key=${sessionKey}`),
                fetchWithRetry(`https://api.openf1.org/v1/intervals?session_key=${sessionKey}`),
                fetchWithRetry(`https://api.openf1.org/v1/sectors?session_key=${sessionKey}`)
            ]);
            
            processLiveData(positionData, driversInfo, intervalsData, sectorsData);
        } else {
            processHistoricalData(lapsData, [], driversInfo);
        }

        updateUI(isLiveSession);
        
        state.lastUpdate = new Date();
        document.getElementById('last-update').textContent = `Dernière mise à jour: ${state.lastUpdate.toLocaleTimeString()}`;
    } catch (error) {
        console.error('Erreur fetchData:', error);
        showError(`Erreur: ${error.message}`);
    }
}

        // ==============================================
        // Fonctions de gestion des sessions
        // ==============================================

        async function loadSessions() {
            try {
                const now = new Date();
                const currentYear = now.getFullYear();
                
                const yearsToFetch = [currentYear, currentYear - 1];
                let allSessions = [];
                
                for (const year of yearsToFetch) {
                    const sessions = await fetchWithRetry(`https://api.openf1.org/v1/sessions?year=${year}`);
                    allSessions = [...allSessions, ...sessions];
                }
                
                const select = document.getElementById('session-select');
                select.innerHTML = '<option value="">Sélectionnez une session</option>';
                
                if (!allSessions || allSessions.length === 0) {
                    select.innerHTML = '<option value="">Aucune session disponible</option>';
                    showError('Aucune session disponible dans les 2 dernières années.');
                    return;
                }
                
                allSessions.sort((a, b) => new Date(b.date_start) - new Date(a.date_start));
                const recentSessions = allSessions.slice(0, 30);
                
                recentSessions.forEach(session => {
                    const option = document.createElement('option');
                    option.value = session.session_key;
                    
                    const sessionDate = new Date(session.date_start);
                    const dateStr = sessionDate.toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    
                    const yearSuffix = sessionDate.getFullYear() !== currentYear ? 
                        ` (${sessionDate.getFullYear()})` : '';
                    
                    option.textContent = `${dateStr}${yearSuffix} - ${session.session_name || 'Session'} (${session.meeting_name || 'Meeting'})`;
                    option.setAttribute('data-end', session.date_end);
                    select.appendChild(option);
                });
            } catch (error) {
                console.error('Erreur lors du chargement des sessions:', error);
                const select = document.getElementById('session-select');
                select.innerHTML = '<option value="">Erreur de chargement des sessions</option>';
                showError('Impossible de charger les sessions. Veuillez vérifier votre connexion internet.');
            }
        }

        function setupEventListeners() {
            let debounceTimer;
            const select = document.getElementById('session-select');
            
            select.addEventListener('change', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    const sessionKey = select.value;
                    if (sessionKey) {
                        try {
                            if (state.refreshIntervalId) {
                                clearInterval(state.refreshIntervalId);
                            }
                            
                            state.currentSessionKey = sessionKey;
                            const selectedOption = select.selectedOptions[0];
                            const sessionEndTime = selectedOption.getAttribute('data-end');
                            
                            const isLive = isSessionLive(sessionEndTime);
                            document.getElementById('session-status').textContent = isLive ? 
                                '(Session en cours)' : '(Session terminée)';
                            
                            await fetchData(sessionKey, isLive);
                            
                            if (isLive) {
                                state.refreshIntervalId = setInterval(() => fetchData(sessionKey, true), REFRESH_INTERVAL);
                            }
                        } catch (error) {
                            console.error('Erreur lors du changement de session:', error);
                            showError('Erreur lors du chargement de la session sélectionnée.');
                        }
                    } else {
                        showLoading();
                        document.getElementById('session-name').textContent = 'Aucune session sélectionnée';
                        document.getElementById('session-status').textContent = '';
                    }
                }, 300);
            });
        }

        function autoLoadLatestSession() {
            const select = document.getElementById('session-select');
            if (select.options.length > 1) {
                select.selectedIndex = 1;
                select.dispatchEvent(new Event('change'));
            }
        }

        // ==============================================
        // Initialisation de l'application
        // ==============================================

        function initTheme() {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const savedTheme = localStorage.getItem('f1-theme');
            
            if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
                document.body.classList.add('light-mode');
                document.querySelector('.theme-toggle i').className = 'fas fa-sun';
            }
            
            document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
        }

        function toggleTheme() {
            const body = document.body;
            const icon = document.querySelector('.theme-toggle i');
            
            body.classList.toggle('light-mode');
            
            if (body.classList.contains('light-mode')) {
                icon.className = 'fas fa-sun';
                localStorage.setItem('f1-theme', 'light');
            } else {
                icon.className = 'fas fa-moon';
                localStorage.setItem('f1-theme', 'dark');
            }
        }

        function testWithKnownSession() {
            // Session de qualification du GP de Monaco 2023 (doit avoir des données complètes)
            const testSessionKey = 9161; 
            document.getElementById('session-select').value = testSessionKey;
            document.getElementById('session-select').dispatchEvent(new Event('change'));
        }

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                initTheme();
                await loadSessions();
                setupEventListeners();
                autoLoadLatestSession();
                
                // Pour tester rapidement avec une session connue
                // testWithKnownSession();
            } catch (error) {
                console.error('Erreur lors de l\'initialisation:', error);
                showError('Erreur lors du chargement initial. Veuillez rafraîchir la page.');
            }
        });