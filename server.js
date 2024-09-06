const express = require('express');
const multer = require('multer');
const { db, bucket } = require('./firebaseConfig');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Configura multer para manejar la subida de archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Función para subir la imagen a Firebase Storage y generar la URL pública con el token
async function uploadImageToStorage(image) {
  console.log('Subiendo imagen a Firebase Storage...');
  const imageName = `${uuidv4()}_${image.originalname}`; 
  const file = bucket.file(imageName);
  const token = uuidv4(); // Genera un token único para acceder a la imagen

  try {
    await file.save(image.buffer, {
      metadata: {
        contentType: image.mimetype, 
        metadata: {
          firebaseStorageDownloadTokens: token // Agrega el token como parte de los metadatos
        }
      }
    });
    console.log('Imagen guardada en Firebase Storage');

    // Construye la URL pública de la imagen con el token
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
    console.log('URL de la imagen:', imageUrl);
    return imageUrl; 
  } catch (error) {
    console.error('Error al guardar la imagen en Firebase Storage:', error);
    throw error;
  }
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
      imageUrl, 
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
    const { usuario, email, contacto, nombre } = req.body;
    const image = req.file; 

    // Validación de datos
    if (!usuario || !email || !contacto || !nombre || !image) {
      console.log('Faltan datos necesarios:', { usuario, email, contacto, nombre, image });
      return res.status(400).send('Faltan datos necesarios para realizar la compra');
    }

    // Subir la imagen a Firebase Storage y guardar los datos en Firestore
    const imageUrl = await uploadImageToStorage(image);
    await savePurchaseData({ usuario, email, contacto, nombre, imageUrl });

    res.status(200).send('Compra realizada con éxito');
  } catch (error) {
    console.error('Error al procesar la compra:', error);
    res.status(500).send('Error al realizar la compra');
  }
});

// Ruta para manejar la búsqueda en la base de datos
app.get('/buscar', async (req, res) => {
  const { term } = req.query;
  console.log('Término de búsqueda:', term);

  if (!term) {
    return res.status(400).send('Término de búsqueda no proporcionado');
  }

  try {
    const snapshot = await db.collection('compras').get();
    const results = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Filtro básico: busca si el término aparece en cualquier campo
      if (
        data.usuario.toLowerCase().includes(term.toLowerCase()) ||
        data.email.toLowerCase().includes(term.toLowerCase()) ||
        data.contacto.toLowerCase().includes(term.toLowerCase()) ||
        data.nombre.toLowerCase().includes(term.toLowerCase())
      ) {
        results.push(data);
      }
    });

    res.status(200).json(results); 
  } catch (error) {
    console.error('Error al buscar en la base de datos:', error);
    res.status(500).send('Error al buscar datos');
  }
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
