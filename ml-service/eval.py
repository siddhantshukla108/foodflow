import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

print("Loading dataset...")
train_df = pd.read_csv('../dataset/train.csv')

features = ['center_id', 'meal_id', 'checkout_price', 'base_price', 'emailer_for_promotion', 'homepage_featured']
target = 'num_orders'

X = train_df[features]
y = train_df[target]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training RandomForest model on 80% split...")
model = RandomForestRegressor(n_estimators=20, max_depth=10, random_state=42, n_jobs=-1)
model.fit(X_train, y_train)

print("Evaluating on 20% test split...")
predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)
r2 = r2_score(y_test, predictions)

print("--- EVALUATION METRICS ---")
print(f"Mean Absolute Error (MAE): {mae:.2f} orders")
print(f"R-squared (R2): {r2:.4f}")
print("--------------------------")
