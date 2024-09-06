const express = require('express');
const multer = require('multer');
const { db, bucket } = require('./firebaseConfig');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { Parser } = require('json2csv'); // Para convertir JSON a CSV

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Función para subir la imagen a Firebase Storage y generar la URL pública con el token
async function uploadImageToStorage(image) {
  const imageName = `${uuidv4()}_${image.originalname}`;
  const file = bucket.file(imageName);
  const token = uuidv4();

  try {
    await file.save(image.buffer, {
      metadata: {
        contentType: image.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
    return imageUrl;
  } catch (error) {
    throw error;
  }
}

// Función para guardar los datos de la compra en Firestore
async function savePurchaseData({ usuario, email, contacto, nombre, imageUrl }) {
  try {
    await db.collection('compras').add({
      usuario,
      email,
      contacto,
      nombre,
      imageUrl,
    });
  } catch (error) {
    throw error;
  }
}

// Ruta para manejar la compra
app.post('/comprar', upload.single('image'), async (req, res) => {
  try {
    const { usuario, email, contacto, nombre } = req.body;
    const image = req.file;

    if (!usuario || !email || !contacto || !nombre || !image) {
      return res.status(400).send('Faltan datos necesarios para realizar la compra');
    }

    const imageUrl = await uploadImageToStorage(image);
    await savePurchaseData({ usuario, email, contacto, nombre, imageUrl });

    res.status(200).send('Compra realizada con éxito');
  } catch (error) {
    res.status(500).send('Error al realizar la compra');
  }
});

// Ruta para buscar datos
app.get('/buscar', async (req, res) => {
  const { term } = req.query;

  if (!term) {
    return res.status(400).send('Término de búsqueda no proporcionado');
  }

  try {
    const snapshot = await db.collection('compras').get();
    const results = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
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
    res.status(500).send('Error al buscar datos');
  }
});

// Ruta para descargar los datos en CSV
app.get('/descargar-csv', async (req, res) => {
  try {
    const snapshot = await db.collection('compras').get();
    const data = [];

    snapshot.forEach((doc) => {
      data.push(doc.data());
    });

    const fields = ['usuario', 'email', 'contacto', 'nombre', 'imageUrl'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment('compras.csv');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error al generar el archivo CSV:', error);
    res.status(500).send('Error al generar el archivo CSV');
  }
});


// Ruta para manejar la subida de stockDije
app.post('/agregar-stock', async (req, res) => {
  const { stockDije } = req.body;

  if (!stockDije) {
    return res.status(400).json({ message: 'No se proporcionó el dato stockDije' });
  }

  // ID del documento que deseas actualizar (puedes cambiarlo según tu necesidad)
  const documentId = 'ID_DEL_DOCUMENTO_A_ACTUALIZAR'; // Asegúrate de colocar el ID correcto aquí

  try {
    // Actualiza el campo stockDije en el documento con el ID específico
    const stockRef = db.collection('stock').doc(documentId);
    
    await stockRef.update({
      stockDije: stockDije
    });

    res.status(200).json({ message: 'Dato stockDije actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar stockDije:', error);
    res.status(500).json({ message: 'Error al actualizar stockDije' });
  }
});


// Inicia el servidor
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});