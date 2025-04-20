import streamlit as st
import pandas as pd
from utils.data_loader import load_weekend_data

st.set_page_config(page_title="F1 FastF1 Viewer", layout="wide")

st.title("🏎️ Visualisateur de données F1 (FastF1)")

# 🎛️ Sélection des paramètres
year = st.selectbox("Sélectionne une année :", list(range(2023, 2021, -1)))
round_number = st.slider("Sélectionne le Grand Prix (round) :", 1, 23, 1)

if st.button("📥 Charger les données"):
    with st.spinner("Chargement en cours..."):
        df = load_weekend_data(year, round_number)

    if df.empty:
        st.warning("Aucune donnée trouvée pour cette course.")
    else:
        st.success(f"{len(df)} lignes chargées pour l'année {year}, round {round_number}")
        
        st.subheader("🔍 Aperçu brut des tours (laps)")
        st.dataframe(df)

        st.subheader("🧮 Colonnes disponibles")
        st.code(", ".join(df.columns))
