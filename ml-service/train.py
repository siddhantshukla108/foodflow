import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import pickle
import os

print("Loading dataset...")
# Load dataset
train_df = pd.read_csv('../dataset/train.csv')

print("Preprocessing...")
# We will use a subset of features for the MVP
features = ['center_id', 'meal_id', 'checkout_price', 'base_price', 'emailer_for_promotion', 'homepage_featured']
target = 'num_orders'

X = train_df[features]
y = train_df[target]

print("Training RandomForest model (this may take a minute)...")
# Train model (limiting depth for faster training in MVP)
model = RandomForestRegressor(n_estimators=20, max_depth=10, random_state=42, n_jobs=-1)
model.fit(X, y)

print("Saving model...")
os.makedirs('models', exist_ok=True)
with open('models/demand_model.pkl', 'wb') as f:
    pickle.dump(model, f)

print("Model trained and saved successfully.")
