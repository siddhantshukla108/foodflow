import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import classification_report, confusion_matrix
import numpy as np

print("Loading validation dataset...")
base_dir = '../dataset/freshness'
batch_size = 32

datagen = ImageDataGenerator(validation_split=0.2, rescale=1./255)
val_generator = datagen.flow_from_directory(
    base_dir,
    target_size=(224, 224),
    batch_size=batch_size,
    class_mode='categorical',
    subset='validation',
    shuffle=False
)

print("Loading saved model...")
model = load_model('models/freshness_model.h5')

print("Evaluating model...")
loss, accuracy = model.evaluate(val_generator)
print(f"Validation Accuracy: {accuracy * 100:.2f}%")

print("\nGenerating predictions for confusion matrix...")
val_generator.reset()
preds = model.predict(val_generator)
y_pred = np.argmax(preds, axis=1)
y_true = val_generator.classes

print("\n--- CONFUSION MATRIX ---")
print(confusion_matrix(y_true, y_pred))

print("\n--- CLASSIFICATION REPORT ---")
target_names = list(val_generator.class_indices.keys())
print(classification_report(y_true, y_pred, target_names=target_names))
