import fastf1
from fastf1.core import Laps
import pandas as pd
import os

def load_weekend_data(year: int, round_number: int):
    session_names = ['FP1', 'FP2', 'FP3', 'Q']
    all_sessions = []

    for session_name in session_names:
        try:
            session = fastf1.get_session(year, round_number, session_name)
            session.load()
            laps = session.laps
            laps['Session'] = session_name
            all_sessions.append(laps)
        except Exception as e:
            print(f"⚠️ Erreur chargement {session_name} {year} GP {round_number} : {e}")
            continue

    # Concaténation des sessions
    if all_sessions:
        df = pd.concat(all_sessions, ignore_index=True)
        df['Year'] = year
        df['Round'] = round_number
        return df
    else:
        return pd.DataFrame()  # Vide si rien récupéré

def load_data_for_season(year: int, rounds: list = None):
    season_data = []

    if rounds is None:
        rounds = list(range(1, 25))  # 24 GP par défaut (ajustable)

    for rnd in rounds:
        print(f"🔄 Chargement GP {rnd} {year}")
        df_gp = load_weekend_data(year, rnd)
        if not df_gp.empty:
            season_data.append(df_gp)

    return pd.concat(season_data, ignore_index=True) if season_data else pd.DataFrame()
