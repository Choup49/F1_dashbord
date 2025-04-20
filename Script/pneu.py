import fastf1
from fastf1.ergast import Ergast
import json

# Active le cache
fastf1.Cache.enable_cache('cache')

# Charge une session (par exemple GP de Bahreïn 2024, course)
session = fastf1.get_session(2024, 'Bahrain', 'R')
session.load()

# Récupère les stints des pilotes = infos sur les pneus utilisés
stints = session.laps.get_stint_summary()

# Convertit en JSON simplifié
pneus_data = []

for index, row in stints.iterrows():
    pneus_data.append({
        'pilote': row['Driver'],
        'team': row['Team'],
        'pneu': row['Compound'],
        'début_tour': int(row['StintStart']),
        'fin_tour': int(row['StintEnd']),
        'nb_tours': int(row['LapCount'])
    })

# Affiche ou exporte
print(json.dumps(pneus_data, indent=2))
