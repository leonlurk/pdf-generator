const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();

app.use(express.static(path.join(__dirname, '../public')));

app.use(express.json());

// Servir archivos estáticos
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/data', express.static(path.join(__dirname, '../public/data')));


// Ruta que lee el CSV y lo normaliza
app.get('/clientes', (req, res) => {
  const results = [];
  const filePath = path.join(__dirname, '../public/data/clientes.csv');

  try {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        const dni = (data['D.N.I'] || '').replace(/[^0-9]/g, '');
        results.push({
          nombre: (data['NOMBRE DEL CLIENTE'] || '').trim(),
          dni,
          domicilio: (data['DIRECCIÓN'] || '').trim(),
          telefono: (data['TELEFONO'] || '').trim(),
        });
      })
      .on('end', () => {
        res.json(results);
      });
  } catch (err) {
    console.error('Error leyendo el CSV:', err);
    res.status(500).send('Error al leer CSV');
  }
});

// Exporta como función serverless
module.exports = app;
