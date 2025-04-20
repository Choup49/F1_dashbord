import asyncio
import fastf1
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from openf1_client import Client as OpenF1Client
import logging
from functools import lru_cache
from datetime import datetime

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("F1-Live-Tracker")

class F1LiveTracker:
    def __init__(self):
        self.session = None
        self.openf1 = OpenF1Client()
        self.circuit_img = None
        self.last_update = None
        self.cached_data = {}
        self.fig = self._init_plot()
        self._load_config()

    def _load_config(self):
        """Charge la configuration initiale"""
        try:
            self.session = fastf1.get_session(datetime.now().year, 'Monza', 'Q')
            self.session.load()
            self.circuit_img = self._load_circuit_image()
            logger.info("Session FastF1 chargée avec succès")
        except Exception as e:
            logger.error(f"Erreur lors du chargement FastF1: {str(e)}")
            self._fallback_to_openf1()

    def _load_circuit_image(self):
        """Charge l'image du circuit avec calibration des coordonnées"""
        # Coordonnées normalisées (à adapter selon le circuit)
        return {
            'image': "https://example.com/circuit_monza.png",
            'x_range': (-1, 1),
            'y_range': (-0.5, 0.5)
        }

    def _fallback_to_openf1(self):
        """Basculer vers OpenF1 si FastF1 échoue"""
        logger.warning("Utilisation d'OpenF1 comme source principale")
        self.session = None

    @lru_cache(maxsize=20)
    def _get_driver_metadata(self, driver_number):
        """Cache les métadonnées des pilotes"""
        if self.session:
            try:
                driver = self.session.get_driver(driver_number)
                return {
                    'name': driver.Abbreviation,
                    'color': driver.TeamColor,
                    'number': driver.DriverNumber
                }
            except:
                pass
        # Fallback OpenF1
        return self.openf1.get_driver(driver_number) or {
            'name': f"DRV{driver_number}",
            'color': '#999999',
            'number': driver_number
        }

    async def _fetch_live_data(self):
        """Récupère et fusionne les données des APIs"""
        try:
            data = {}
            
            # Récupération des positions
            if self.session:
                pos_data = self.session.pos_data
                for driver in pos_data:
                    data[driver] = {
                        'x': pos_data[driver].X,
                        'y': pos_data[driver].Y,
                        **self._get_driver_metadata(driver)
                    }
            else:
                positions = self.openf1.get_positions()
                for pos in positions:
                    data[pos['driver_number']] = {
                        'x': pos['x'],
                        'y': pos['y'],
                        **self._get_driver_metadata(pos['driver_number'])
                    }

            # Enrichissement avec pneus et statuts
            stints = self.openf1.get_stints() or {}
            weather = self.openf1.get_weather() or {}
            
            for driver in data.copy():
                data[driver].update({
                    'tyre': stints.get(driver, {}).get('tyre', 'UNK'),
                    'laps': stints.get(driver, {}).get('lap_count', 0),
                    'status': 'ACTIVE'  # Par défaut
                })

            self.cached_data = data
            self.last_update = datetime.now()
            return data
            
        except Exception as e:
            logger.error(f"Erreur fetch data: {str(e)}")
            return self.cached_data

    def _init_plot(self):
        """Initialise la visualisation Plotly"""
        fig = make_subplots()
        
        # Configuration de base
        fig.update_layout(
            title="F1 Live Tracker - Positions en Temps Réel",
            xaxis=dict(visible=False, range=self.circuit_img['x_range']),
            yaxis=dict(visible=False, range=self.circuit_img['y_range']),
            hovermode='closest',
            template='plotly_dark',
            images=[dict(
                source=self.circuit_img['image'],
                xref="x", yref="y",
                x=self.circuit_img['x_range'][0],
                y=self.circuit_img['y_range'][1],
                sizex=abs(self.circuit_img['x_range'][1] - self.circuit_img['x_range'][0]),
                sizey=abs(self.circuit_img['y_range'][1] - self.circuit_img['y_range'][0]),
                sizing="stretch",
                layer="below"
            )]
        )
        
        # Trace initiale vide
        fig.add_trace(go.Scatter(
            x=[],
            y=[],
            mode='markers+text',
            marker=dict(size=12),
            textposition='top center',
            hoverinfo='text',
            name='Pilotes'
        ))
        
        return fig

    def _generate_tooltip(self, driver_data):
        """Génère le texte du tooltip"""
        return (
            f"<b>{driver_data['name']} (#{driver_data['number']})</b><br>"
            f"Position: {driver_data.get('position', 'N/A')}<br>"
            f"Pneus: {driver_data['tyre']} (L{driver_data['laps']})<br>"
            f"Statut: {driver_data.get('status', 'ACTIVE')}<br>"
            f"Dernière mise à jour: {self.last_update.strftime('%H:%M:%S')}"
        )

    def _update_plot(self, data):
        """Met à jour le graphique avec les nouvelles données"""
        if not data:
            return
            
        x, y, colors, texts = [], [], [], []
        
        for driver in data.values():
            x.append(driver['x'])
            y.append(driver['y'])
            colors.append(driver['color'])
            texts.append(self._generate_tooltip(driver))
        
        with self.fig.batch_update():
            self.fig.data[0].x = x
            self.fig.data[0].y = y
            self.fig.data[0].marker.color = colors
            self.fig.data[0].text = texts
            self.fig.data[0].marker.symbol = [
                'circle-open' if d.get('status') == 'PIT' else 'circle' 
                for d in data.values()
            ]

    async def run(self):
        """Boucle principale de mise à jour"""
        while True:
            try:
                data = await self._fetch_live_data()
                self._update_plot(data)
                await asyncio.sleep(5)  # Mise à jour toutes les 5s
            except Exception as e:
                logger.error(f"Erreur dans la boucle principale: {str(e)}")
                await asyncio.sleep(10)  # Attente plus longue en cas d'erreur

def main():
    tracker = F1LiveTracker()
    
    try:
        # Pour Jupyter Notebook: tracker.fig.show()
        # Pour Streamlit:
        # import streamlit as st
        # st.plotly_chart(tracker.fig, use_container_width=True)
        
        asyncio.run(tracker.run())
    except KeyboardInterrupt:
        logger.info("Arrêt demandé par l'utilisateur")

if __name__ == "__main__":
    main()