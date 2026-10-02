from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import pandas as pd
import os
import numpy as np
from tensorflow.keras.models import load_model as tf_load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from io import BytesIO

app = Flask(__name__)
CORS(app)

model = None
vision_model = None
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'models/demand_model.pkl')
VISION_MODEL_PATH = os.path.join(BASE_DIR, 'models/freshness_model.h5')

def load_models():
    global model, vision_model
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
            print("Demand model loaded successfully.")
    
    if os.path.exists(VISION_MODEL_PATH):
        try:
            vision_model = tf_load_model(VISION_MODEL_PATH)
            print("Vision model loaded successfully.")
        except Exception as e:
            print("Warning: Vision model load failed", e)
    else:
        print("Warning: Vision model not found. Run train_vision.py first.")

load_models()

@app.route('/predict-demand', methods=['POST'])
def predict_demand():
    if model is None:
        return jsonify({"error": "Model not loaded on server."}), 500

    try:
        data = request.json
        features = {
            'center_id': data.get('center_id', 55),
            'meal_id': data.get('meal_id', 1993),
            'checkout_price': data.get('checkout_price', 150.0),
            'base_price': data.get('base_price', 150.0),
            'emailer_for_promotion': data.get('emailer_for_promotion', 0),
            'homepage_featured': data.get('homepage_featured', 0)
        }
        
        df = pd.DataFrame([features])
        prediction = model.predict(df)[0]
        
        return jsonify({
            "predicted_orders": int(round(prediction))
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/check-freshness', methods=['POST'])
def check_freshness():
    if vision_model is None:
        return jsonify({"error": "Vision model not loaded on server."}), 500

    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files['image']
    try:
        img = load_img(BytesIO(file.read()), target_size=(224, 224))
        img_array = img_to_array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        preds = vision_model.predict(img_array)
        # Classes: 0: Fresh, 1: Rotten (based on alphabetical folder names)
        class_idx = np.argmax(preds[0])
        confidence = float(preds[0][class_idx]) * 100
        
        status = "Fresh" if class_idx == 0 else "Spoiled"

        return jsonify({
            "status": status,
            "confidence": f"{confidence:.1f}%"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy", 
        "demand_model_loaded": model is not None,
        "vision_model_loaded": vision_model is not None
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)
