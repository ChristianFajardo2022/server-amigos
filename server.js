const express = require('express');
const multer = require('multer');
const { db, bucket } = require('./firebaseConfig');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Permitir solicitudes desde otros orígenes
app.use(express.json()); // Manejar datos JSON

// Configura multer para manejar la subida de archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Función para subir la imagen a Firebase Storage
async function uploadImageToStorage(image) {
  console.log('Subiendo imagen a Firebase Storage...');
  const imageName = `${uuidv4()}_${image.originalname}`; // Genera un nombre único para la imagen
  console.log('Nombre de la imagen:', imageName);

  const file = bucket.file(imageName);
  console.log('Archivo de bucket creado:', file.name);

  try {
    await file.save(image.buffer, {
      metadata: {
        contentType: image.mimetype, // Especifica el tipo MIME de la imagen
      },
    });
    console.log('Imagen guardada en Firebase Storage');
  } catch (error) {
    console.error('Error al guardar la imagen en Firebase Storage:', error);
    throw error;
  }

  const imageUrl = `https://storage.googleapis.com/${bucket.name}/${imageName}`;
  console.log('URL de la imagen:', imageUrl);
  return imageUrl; // Retorna la URL de la imagen
}

// Función para guardar los datos de la compra en Firestore
async function savePurchaseData({ usuario, email, contacto, nombre, imageUrl }) {
  console.log('Guardando datos de la compra en Firestore...');
  try {
    await db.collection('compras').add({
      usuario,
      email,
      contacto,
      nombre,
      imageUrl, // URL de la imagen guardada en Firebase Storage
    });
    console.log('Datos de la compra guardados en Firestore');
  } catch (error) {
    console.error('Error al guardar los datos en Firestore:', error);
    throw error;
  }
}

// Ruta para manejar la compra
app.post('/comprar', upload.single('image'), async (req, res) => {
  try {
    console.log('Solicitud de compra recibida:', req.body);
    const { usuario, email, contacto, nombre } = req.body; // Datos del cliente
    const image = req.file; // Imagen subida

    // Validación de datos
    if (!usuario || !email || !contacto || !nombre || !image) {
      console.log('Faltan datos necesarios:', { usuario, email, contacto, nombre, image });
      return res.status(400).send('Faltan datos necesarios para realizar la compra');
    }

    // Subir la imagen a Firebase Storage y guardar los datos en Firestore
    const imageUrl = await uploadImageToStorage(image);
    await savePurchaseData({ usuario, email, contacto, nombre, imageUrl });

    res.status(200).send('Compra realizada con éxito'); // Respuesta exitosa
  } catch (error) {
    console.error('Error al procesar la compra:', error);
    res.status(500).send('Error al realizar la compra'); // Manejo de errores
  }
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
