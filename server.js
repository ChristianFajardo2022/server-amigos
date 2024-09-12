const express = require('express');
const multer = require('multer');
const { db, bucket } = require('./firebaseConfig');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { Parser } = require('json2csv');

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

// Función para obtener y actualizar el número consecutivo de manera atómica
async function getConsecutiveNumber() {
  const docRef = db.collection('consecutivos').doc('ordenCompra'); // Documento que almacena el número consecutivo

  try {
    const consecutiveNumber = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      let nuevoConsecutivo = 1; // Si es la primera vez, comienza en 1
      if (doc.exists) {
        nuevoConsecutivo = doc.data().ultimoConsecutivo + 1;
      }

      // Actualiza el nuevo número consecutivo en el documento
      transaction.set(docRef, { ultimoConsecutivo: nuevoConsecutivo });

      return nuevoConsecutivo;
    });

    return consecutiveNumber;
  } catch (error) {
    throw new Error('Error al obtener y actualizar el número consecutivo');
  }
}

// Función para guardar los datos de la compra en Firestore
async function savePurchaseData({ usuario, email, contacto, nombre, imageUrl, consecutivo }) {
  try {
    await db.collection('compras').add({
      usuario,
      email,
      contacto,
      nombre,
      imageUrl,
      consecutivo, // Guardar el número consecutivo
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

    // Obtener el número consecutivo único de manera segura
    const consecutivo = await getConsecutiveNumber();

    // Subir la imagen a Firebase Storage
    const imageUrl = await uploadImageToStorage(image);

    // Guardar los datos de la compra junto con el número consecutivo
    await savePurchaseData({ usuario, email: `${email}-${consecutivo}`, contacto, nombre, imageUrl, consecutivo });

    res.status(200).send('Compra realizada con éxito');
  } catch (error) {
    res.status(500).send('Error al realizar la compra');
  }
});

// Ruta para obtener el último número consecutivo
app.get('/ultimo-numero', async (req, res) => {
  const docRef = db.collection('consecutivos').doc('ordenCompra');

  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const data = doc.data();
    res.status(200).json({ ultimoNumero: data.ultimoConsecutivo });
  } catch (error) {
    console.error('Error al obtener el último número consecutivo:', error.message);
    res.status(500).send('Error al obtener el último número consecutivo');
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

  const documentId = 'numerosdestock';

  try {
    const stockRef = db.collection('stock').doc(documentId);
    const docSnapshot = await stockRef.get();

    if (!docSnapshot.exists) {
      return res.status(404).json({ message: 'El documento no existe' });
    }

    // Intenta actualizar el documento
    await stockRef.update({
      stockDije: stockDije
    });

    res.status(200).json({ message: 'Dato stockDije actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar stockDije:', error.message);
    res.status(500).json({ message: `Error al actualizar stockDije: ${error.message}` });
  }
});

// Ruta para obtener el stock
app.get('/dijes', async (req, res) => {
  try {
    const documentId = 'numerosdestock';
    const stockRef = db.collection('stock').doc(documentId);
    const docSnapshot = await stockRef.get();

    if (!docSnapshot.exists) {
      return res.status(404).json({ message: 'El documento no existe' });
    }

    const data = docSnapshot.data();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al buscar datos del stock:', error.message);
    res.status(500).send('Error al buscar datos del stock');
  }
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
