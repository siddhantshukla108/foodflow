import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import os

print("Setting up MobileNetV2 for Transfer Learning...")

base_dir = '../dataset/freshness'
batch_size = 32
epochs = 3 # Keep it small for fast MVP training

# Data Generators
datagen = ImageDataGenerator(validation_split=0.2, rescale=1./255)

train_generator = datagen.flow_from_directory(
    base_dir,
    target_size=(224, 224),
    batch_size=batch_size,
    class_mode='categorical',
    subset='training'
)

val_generator = datagen.flow_from_directory(
    base_dir,
    target_size=(224, 224),
    batch_size=batch_size,
    class_mode='categorical',
    subset='validation'
)

# Load MobileNetV2 without the top classification layer
base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))

# Freeze the base layers so we only train the new classification head
base_model.trainable = False

# Add custom classification head for Fresh vs Rotten
x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(128, activation='relu')(x)
predictions = Dense(train_generator.num_classes, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=predictions)

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

print(f"Training on {train_generator.samples} images, validating on {val_generator.samples} images...")

model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=epochs
)

os.makedirs('models', exist_ok=True)
model.save('models/freshness_model.h5')
print("Model saved to models/freshness_model.h5")
