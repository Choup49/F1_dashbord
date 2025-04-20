from utils.data_loader import load_data_for_season
df_2023 = load_data_for_season(2023, rounds=list(range(1, 23)))
print(df_2023[['Driver', 'LapTime', 'Session']].head())
