import streamlit as st
import pandas as pd

# Chargement des données
df = pd.read_csv("2024_bahrain_practice_lap_times.csv")

# Titre
st.title("Analyse des temps au tour en essais libres F1")

# Sélection du pilote
pilote = st.selectbox("Choisissez un pilote :", df.index)

# Affichage des temps du pilote sélectionné
st.write("Temps au tour du pilote :", pilote)
st.line_chart(df.loc[pilote].drop("average_lap_time"))
