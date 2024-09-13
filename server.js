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

// Función para guardar los datos de la compra en Firestore
async function savePurchaseData({ usuario, email, contacto, nombre, imageUrl, fechaHora }) {
  try {
    await db.collection('compras').add({
      usuario,
      email,
      contacto,
      nombre,
      imageUrl,
      fechaHora, // Guardar la fecha y hora
    });
  } catch (error) {
    throw error;
  }
}

// Función para convertir la fecha de Firestore a una cadena legible
const convertDateToReadableFormat = (userData) => {
  if (userData.createdAt && userData.createdAt.toDate) {
    const createdAtUTC = userData.createdAt.toDate();
    const createdAtUTCMinus5 = new Date(createdAtUTC.getTime()-(5 * 60 * 60 * 1000)); // Resta 5 horas (en milisegundos)
    userData.createdAt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(createdAtUTCMinus5); // Formatea la fecha en UTC-5
  }
  return userData;
};

// Ruta para manejar la compra
app.post('/comprar', upload.single('image'), async (req, res) => {
  try {
    const { usuario, email, contacto, nombre } = req.body;
    const image = req.file;

    if (!usuario || !email || !contacto || !nombre || !image) {
      return res.status(400).send('Faltan datos necesarios para realizar la compra');
    }

    // Subir la imagen a Firebase Storage
    const imageUrl = await uploadImageToStorage(image);

    // Obtener la fecha y hora actual
    const fechaHora = new Date().toISOString();
    console.log({usuario, email, contacto, nombre, imageUrl, fechaHora})
    // Guardar los datos de la compra junto con la fecha y hora
    await savePurchaseData({ usuario, email, contacto, nombre, imageUrl, fechaHora });

    res.status(200).send('Compra realizada con éxito');
    
  } catch (error) {
    res.status(500).send('Error al realizar la compra');
  }
});

// Ruta para obtener los datos de compra
app.get('/compras', async (req, res) => {
  try {
    const snapshot = await db.collection('compras').get();
    const compras = [];

    snapshot.forEach((doc) => {
      let data = doc.data();
      data = convertDateToReadableFormat(data); // Convertir la fecha a formato legible
      compras.push(data);
    });

    res.status(200).json(compras);
  } catch (error) {
    res.status(500).send('Error al obtener los datos de compra');
  }
});

// Ruta para descargar los datos en CSV
app.get('/descargar-csv', async (req, res) => {
  try {
    const snapshot = await db.collection('compras').get();
    const data = [];

    snapshot.forEach((doc) => {
      let docData = doc.data();
      docData = convertDateToReadableFormat(docData); // Convertir la fecha a formato legible
      data.push(docData);
    });

    const fields = ['usuario', 'email', 'contacto', 'nombre', 'imageUrl', 'fechaHora', 'numeroOrden'];
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
// Ruta para manejar la subida de stockDije y agregar número de orden
app.post('/agregar-stock', async (req, res) => {
  const { stockDije, email, numeroOrden } = req.body;

  if (!stockDije || !email || !numeroOrden) {
    return res.status(400).json({ message: 'Faltan datos necesarios' });
  }

  const documentId = 'numerosdestock';

  try {
    // Actualizar stockDije
    const stockRef = db.collection('stock').doc(documentId);
    const docSnapshot = await stockRef.get();

    if (!docSnapshot.exists) {
      return res.status(404).json({ message: 'El documento de stock no existe' });
    }

    // Actualiza el stockDije
    await stockRef.update({
      stockDije: stockDije
    });

    // Buscar el documento en la colección de compras por email
    const snapshot = await db.collection('compras').where('email', '==', email).get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'No se encontró ningún documento con ese email' });
    }

    // Actualizar el campo numeroOrden en el documento encontrado
    const batch = db.batch(); // Usar batch para actualizar múltiples documentos si es necesario
    snapshot.forEach(doc => {
      const compraRef = db.collection('compras').doc(doc.id);
      batch.update(compraRef, { numeroOrden: numeroOrden });
    });

    await batch.commit();

    res.status(200).json({ message: 'stockDije actualizado y número de orden agregado con éxito' });
console.log({stockDije, numeroOrden});

  } catch (error) {
    console.error('Error al actualizar stockDije o número de orden:', error.message);
    res.status(500).json({ message: `Error al actualizar stockDije o número de orden: ${error.message}` });
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
        results.push({ ...data, docId: doc.id }); // Añadir el ID del documento
      }
    });

    res.status(200).json(results);
  } catch (error) {
    res.status(500).send('Error al buscar datos');
  }
});

// Ruta para agregar el número de orden a un documento
app.post('/agregar-numero-orden', async (req, res) => {
  const { docId, orderNum } = req.body;

  if (!docId || !orderNum) {
    return res.status(400).json({ message: 'Faltan datos necesarios' });
  }

  try {
    const docRef = db.collection('compras').doc(docId);

    // Actualizar el documento con el número de orden
    await docRef.update({ numeroOrden: orderNum });

    res.status(200).json({ message: 'Número de orden agregado con éxito' });
  } catch (error) {
    console.error('Error al agregar el número de orden:', error.message);
    res.status(500).json({ message: `Error al agregar el número de orden: ${error.message}` });
  }
});

// Ruta para verificar el acceso del usuario
// Endpoint para verificar usuario
app.post('/verificar-usuario', async (req, res) => {
  const { usuario, contraseña } = req.body;

  if (!usuario || !contraseña) {
    return res.status(400).json({ access: false, message: 'Datos incompletos' });
  }

  try {
    // Aquí deberías implementar la lógica para verificar las credenciales del usuario
    const userRef = db.collection('usuario').doc(usuario);
    const doc = await userRef.get();

    if (doc.exists && doc.data().contraseña === contraseña) {
      return res.status(200).json({ access: true });
    } else {
      return res.status(401).json({ access: false, message: 'Credenciales incorrectas' });
    }
  } catch (error) {
    console.error('Error al verificar el usuario:', error);
    return res.status(500).json({ access: false, message: 'Error interno del servidor' });
  }
});


// Inicia el servidor
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
