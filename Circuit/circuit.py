import fastf1
import fastf1.plotting
from matplotlib import pyplot as plt
from matplotlib.animation import FuncAnimation
from matplotlib.patches import Circle, Rectangle
import os


# Chemin ABSOLU vers le dossier cache
cache_path = r"C:/Users/AXEL.MOISAN/Documents/Dev-code/Project_F1/Circuit/cache"

# Vérification et création du dossier si besoin
if not os.path.exists(cache_path):
    os.makedirs(cache_path)
    print(f"Dossier cache créé : {cache_path}")

fastf1.Cache.enable_cache(cache_path)  # Activation avec chemin absolu

# 1. Configuration
fastf1.Cache.enable_cache('./cache')  # Cache pour les données
fastf1.plotting.setup_mpl()  # Style F1 officiel

# 2. Charger une session
session = fastf1.get_session(2023, 'Monza', 'R')
session.load()  # Téléchargement des données

# 3. Créer la visualisation
fig, ax = plt.subplots(figsize=(12, 8))
session.plot(ax=ax)  # Dessine le circuit

# 4. Préparer les éléments dynamiques
driver_circles = {}
for driver in session.drivers:
    driver_circles[driver] = Circle(
        (0, 0), radius=15, 
        color=fastf1.plotting.driver_color(driver),
        zorder=10
    )
    ax.add_patch(driver_circles[driver])

# 5. Fonction d'animation
def update(frame):
    for driver in session.drivers:
        try:
            # Récupère la position actuelle
            lap = session.laps.pick_driver(driver).iloc[-1]
            tel = lap.get_telemetry().iloc[-1]
            
            # Met à jour le marqueur
            driver_circles[driver].center = (tel['X'], tel['Y'])
            
            # Highlight le meilleur tour
            if lap['IsPersonalBest']:
                driver_circles[driver].set_radius(20)
            else:
                driver_circles[driver].set_radius(15)
                
        except Exception:
            continue
    
    ax.set_title(f"Lap {frame}/{session.total_laps}")
    return list(driver_circles.values())

# 6. Lancer l'animation
ani = FuncAnimation(
    fig, update, frames=session.total_laps,
    interval=500, blit=True
)

plt.tight_layout()
plt.show()