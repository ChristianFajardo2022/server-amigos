const admin = require('firebase-admin');
const path = require('path');

// Carga las variables de entorno desde el archivo .env (en desarrollo)
require('dotenv').config();

// Configura la ruta del archivo de credenciales utilizando una variable de entorno
const serviceAccountPath = path.resolve(process.env.FIREBASE_CREDENTIALS_PATH);
const serviceAccount = require(serviceAccountPath); // Carga el archivo de credenciales

// Inicializa Firebase con las credenciales y el bucket de almacenamiento
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
} catch (error) {
  console.error('Error al inicializar Firebase:', error);
  process.exit(1); // Termina el proceso si hay un error
}

// Exporta Firestore y el bucket de almacenamiento
const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
