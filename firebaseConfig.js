const admin = require('firebase-admin');
const path = require('path');

// Carga las variables de entorno desde el archivo .env (en desarrollo)
require('dotenv').config();

// Configura la ruta del archivo de credenciales utilizando una variable de entorno
const serviceAccountPath = path.resolve(process.env.FIREBASE_CREDENTIALS_PATH);
console.log('Ruta del archivo de credenciales:', serviceAccountPath);

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath); // Carga el archivo de credenciales
  console.log('Archivo de credenciales cargado exitosamente');
} catch (error) {
  console.error('Error al cargar el archivo de credenciales:', error);
  process.exit(1); // Termina el proceso si hay un error
}

// Inicializa Firebase con las credenciales y el bucket de almacenamiento
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  console.log('Firebase inicializado exitosamente con el bucket:', process.env.FIREBASE_STORAGE_BUCKET);
} catch (error) {
  console.error('Error al inicializar Firebase:', error);
  process.exit(1); // Termina el proceso si hay un error
}

// Exporta Firestore y el bucket de almacenamiento
const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
