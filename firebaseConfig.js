const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Ajusta la ruta según la ubicación de tu archivo

// Inicializa Firebase con las credenciales y el bucket de almacenamiento
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'amigos-ef0e5.appspot.com' // Reemplaza con el ID de tu proyecto Firebase
  });
} catch (error) {
  console.error('Error al inicializar Firebase:', error);
  process.exit(1); // Termina el proceso si hay un error
}

// Exporta Firestore y el bucket de almacenamiento
const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
