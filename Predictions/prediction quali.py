import requests
import pandas as pd

# 🔧 Convertit les temps format mm:ss.xxx en secondes
def convert_to_seconds(laptime):
    if laptime is None:
        return float('inf')
    minutes, seconds = map(float, laptime.split(':'))
    return minutes * 60 + seconds

# 🔍 Récupère les sessions FP1, FP2, FP3 pour le GP d'Arabie Saoudite 2025
def get_saudi_arabia_sessions_2025():
    url = "https://api.openf1.org/v1/sessions"
    response = requests.get(url)

    if response.status_code != 200:
        print("❌ Erreur lors de la récupération des sessions.")
        return []

    all_sessions = response.json()

    # Filtre sessions du GP d’Arabie Saoudite 2025 et de type FP1-3
    saudi_sessions = [
        s for s in all_sessions
        if s['country_name'] == 'Saudi Arabia'
        and s['year'] == 2025
        and s['session_name'] in ['FP1', 'FP2', 'FP3']
    ]

    # Tri des sessions dans l'ordre FP1 → FP2 → FP3
    order = {'FP1': 1, 'FP2': 2, 'FP3': 3}
    saudi_sessions.sort(key=lambda s: order[s['session_name']])

    return saudi_sessions

# 📊 Affiche les meilleurs temps pour chaque pilote d’une session
def display_best_laptimes(session_name, session_key):
    print(f"\n=== {session_name} ===")

    laps_url = "https://api.openf1.org/v1/laps"
    params = {"session_key": session_key}
    response = requests.get(laps_url, params=params)

    if response.status_code != 200:
        print(f"❌ Erreur lors de la récupération des tours pour {session_name}")
        return

    laps = response.json()

    best_times = {}
    for lap in laps:
        if lap['lap_number'] <= 1:  # On ignore le tour de sortie
            continue
        driver = f"{lap['first_name']} {lap['last_name']}"
        laptime = lap.get('lap_time')
        time_in_sec = convert_to_seconds(laptime)

        if driver not in best_times or time_in_sec < best_times[driver]:
            best_times[driver] = time_in_sec

    # Tri par meilleur temps
    sorted_laps = sorted(best_times.items(), key=lambda x: x[1])

    # Affichage
    for i, (driver, sec) in enumerate(sorted_laps, 1):
        if sec == float('inf'):
            continue
        min = int(sec // 60)
        s = sec % 60
        print(f"{i}. {driver}: {min}:{s:.3f}")

# 🚀 Programme principal
def main():
    sessions = get_saudi_arabia_sessions_2025()
    if not sessions:
        print("⚠️ Aucune session trouvée.")
        return

    for session in sessions:
        display_best_laptimes(session['session_name'], session['session_key'])

if __name__ == "__main__":
    main()
