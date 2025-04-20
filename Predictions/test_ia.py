import json
import numpy as np
from datetime import datetime, timedelta
import random

class F1PredictionModel:
    def __init__(self):
        self.drivers = [
            {"name": "Max Verstappen", "team": "Red Bull Racing", "skill": 0.95, "car_performance": 0.95},
            {"name": "Sergio Perez", "team": "Red Bull Racing", "skill": 0.88, "car_performance": 0.93},
            {"name": "Lewis Hamilton", "team": "Mercedes", "skill": 0.93, "car_performance": 0.85},
            {"name": "George Russell", "team": "Mercedes", "skill": 0.89, "car_performance": 0.84},
            {"name": "Charles Leclerc", "team": "Ferrari", "skill": 0.91, "car_performance": 0.82},
            {"name": "Carlos Sainz", "team": "Ferrari", "skill": 0.87, "car_performance": 0.81},
            {"name": "Fernando Alonso", "team": "Aston Martin", "skill": 0.92, "car_performance": 0.83},
            {"name": "Lance Stroll", "team": "Aston Martin", "skill": 0.78, "car_performance": 0.80},
            # Ajouter les autres pilotes...
        ]
        
        self.circuits = {
            "monaco": {"name": "Circuit de Monaco", "difficulty": 0.9, "overtaking": 0.2},
            "spa": {"name": "Circuit de Spa-Francorchamps", "difficulty": 0.85, "overtaking": 0.7},
            # Ajouter d'autres circuits...
        }
    
    def calculate_driver_score(self, driver, circuit):
        """Calcule un score composite pour un pilote sur un circuit donné"""
        base_score = (driver["skill"] * 0.6 + driver["car_performance"] * 0.4)
        
        # Ajustements selon les caractéristiques du circuit
        if circuit["overtaking"] < 0.3:  # Circuits avec peu de dépassements
            base_score *= 1 + (driver["skill"] * 0.1)
        
        # Ajouter un peu d'aléatoire pour simuler l'imprévisible
        base_score *= random.uniform(0.95, 1.05)
        
        return base_score
    
    def generate_probabilities(self, circuit_name):
        """Génère les probabilités de victoire et podium pour chaque pilote"""
        circuit = self.circuits[circuit_name]
        
        # Calculer les scores pour tous les pilotes
        driver_scores = []
        for driver in self.drivers:
            score = self.calculate_driver_score(driver, circuit)
            driver_scores.append((driver["name"], score))
        
        # Trier par score décroissant
        driver_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Convertir les scores en probabilités avec softmax
        scores = np.array([score for _, score in driver_scores])
        exp_scores = np.exp(scores - np.max(scores))  # Pour stabilité numérique
        win_probs = exp_scores / np.sum(exp_scores)
        
        # Calculer les probabilités de podium (top 3)
        podium_probs = []
        for i, prob in enumerate(win_probs):
            # Plus un pilote est souvent en haut du classement, plus sa proba de podium est élevée
            podium_prob = min(prob * (len(self.drivers) / (i + 1)), 0.99)
            podium_probs.append(podium_prob)
        
        # Normaliser les probabilités de podium
        podium_probs = np.array(podium_probs)
        podium_probs = podium_probs / np.sum(podium_probs) * 3  # On veut environ 3 pilotes sur le podium
        
        # Créer la structure de sortie
        predictions = {
            "circuit": {
                "name": circuit["name"],
                "location": circuit_name.capitalize(),
                "date": (datetime.now() + timedelta(days=7)).isoformat()  # Course dans 7 jours
            },
            "last_updated": datetime.now().isoformat(),
            "top_drivers": [],
            "drivers": []
        }
        
        # Générer le commentaire d'analyse
        top_driver = driver_scores[0][0]
        predictions["ai_commentary"] = self.generate_commentary(top_driver, circuit_name)
        
        # Remplir les données des pilotes
        for i, ((name, _), win_prob, podium_prob) in enumerate(zip(driver_scores, win_probs, podium_probs)):
            driver_data = {
                "name": name,
                "team": next(d["team"] for d in self.drivers if d["name"] == name),
                "win_probability": float(win_prob),
                "podium_probability": float(min(podium_prob, 0.99))  # Limiter à 99%
            }
            
            predictions["drivers"].append(driver_data)
            
            if i < 5:  # Top 5 seulement
                predictions["top_drivers"].append(driver_data)
        
        return predictions
    
    def generate_commentary(self, top_driver, circuit_name):
        """Génère un commentaire d'analyse basé sur les prédictions"""
        circuit = self.circuits[circuit_name]
        comments = [
            f"{top_driver} est le grand favori sur ce circuit. ",
            f"La bataille pour la victoire devrait tourner autour de {top_driver} sur ce tracé. ",
            f"Selon nos analyses, {top_driver} a les meilleures chances de l'emporter. "
        ]
        
        if circuit["overtaking"] < 0.3:
            comments.append("Les dépassements étant difficiles, la qualification sera cruciale.")
        else:
            comments.append("Ce circuit permettant de nombreux dépassements, la course pourrait réserver des surprises.")
        
        return random.choice(comments[:3]) + comments[3]
    
    def save_to_json(self, data, filename="predictions.json"):
        """Sauvegarde les prédictions dans un fichier JSON"""
        with open(filename, "w") as f:
            json.dump(data, f, indent=4)
        
        print(f"Prédictions sauvegardées dans {filename}")

# Exemple d'utilisation
if __name__ == "__main__":
    model = F1PredictionModel()
    
    # Générer les prédictions pour le GP de Monaco
    predictions = model.generate_probabilities("monaco")
    
    # Sauvegarder les prédictions
    model.save_to_json(predictions)
    
    # Afficher un aperçu
    print("\nTop 5 des prédictions:")
    for i, driver in enumerate(predictions["top_drivers"]):
        print(f"{i+1}. {driver['name']} - Victoire: {driver['win_probability']*100:.1f}% | Podium: {driver['podium_probability']*100:.1f}%")
    
    print(f"\nCommentaire de l'IA: {predictions['ai_commentary']}")