// server.js - Archivo principal de la API mejorado
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const { PDFDocument: PDFLib } = require('pdf-lib');
const Papa = require('papaparse'); // Añadido para manejar CSV

// Crear la aplicación Express
const app = express();
const PORT = process.env.PORT || 3001; // Cambiado a 3001 para evitar conflictos

// Middlewares con límites aumentados para manejar PDFs grandes
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Configuración mejorada de directorios
const baseDir = __dirname;
const publicDir = path.join(baseDir, 'public');
const tmpDir = path.join(baseDir, 'tmp');
const imagesDir = path.join(publicDir, 'images');
const dataDir = path.join(publicDir, 'data');

// Configurar directorio estático
app.use(express.static(publicDir));

// Función para crear directorios si no existen
function createDirIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Directorio creado: ${dir}`);
    } catch (error) {
      console.error(`Error al crear directorio ${dir}:`, error);
    }
  }
}

// Crear carpetas necesarias si no existen
createDirIfNotExists(publicDir);
createDirIfNotExists(tmpDir);
createDirIfNotExists(imagesDir);
createDirIfNotExists(dataDir);

// Variable global para almacenar los datos de clientes
let clientesData = [];

// Función mejorada para cargar el CSV de clientes
function cargarCSVClientes() {
  try {
    const csvPath = path.join(dataDir, 'clientes.csv');
    
    // Verificar si existe el archivo
    if (!fs.existsSync(csvPath)) {
      console.warn('Archivo de clientes no encontrado en:', csvPath);
      console.log('Contenido del directorio data:', fs.readdirSync(dataDir));
      return;
    }
    
    // Leer el archivo como Buffer para manejar distintas codificaciones
    const csvBuffer = fs.readFileSync(csvPath);
    
    // Intentar con distintas codificaciones
    let csvContent;
    try {
      csvContent = csvBuffer.toString('utf8');
      if (csvContent.includes('�')) {
        // Si hay caracteres inválidos, intentar con Latin1
        csvContent = csvBuffer.toString('latin1');
      }
    } catch (e) {
      csvContent = csvBuffer.toString('latin1');
    }
    
    console.log("Primeras 100 caracteres del CSV:", csvContent.substring(0, 100));
    
    // Parsear el CSV
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Mantener como strings para manejar los DNI con comas
      transformHeader: h => h.trim() // Normalizar encabezados
    });
    
    if (result.errors && result.errors.length > 0) {
      console.error('Errores al parsear el CSV:', result.errors);
      return;
    }
    
    // Verificar las columnas del CSV
    const firstRow = result.data[0];
    console.log('Encabezados detectados:', Object.keys(firstRow));
    
    // Normalizar los datos del CSV
    clientesData = result.data.map(row => {
      // Determinar qué columnas usar basado en los encabezados (insensible a mayúsculas)
      const headers = Object.keys(row).map(h => h.toLowerCase());
      
      let nombreKey = headers.find(h => h.includes('nombre')) || '';
      let dniKey = headers.find(h => h.includes('dni') || h.includes('d.n.i')) || '';
      let direccionKey = headers.find(h => h.includes('direccion') || h.includes('dirección')) || '';
      let telefonoKey = headers.find(h => h.includes('telefono') || h.includes('teléfono')) || '';
      
      // Si no encontramos las claves, usar las originales que podamos encontrar
      const nombreColumn = row[nombreKey] || row['NOMBRE DEL CLIENTE'] || row['NOMBRE'] || row['nombre'] || '';
      const dniColumn = row[dniKey] || row['D.N.I'] || row['DNI'] || row['dni'] || '';
      const direccionColumn = row[direccionKey] || row['DIRECCIÓN'] || row['DIRECCION'] || row['direccion'] || '';
      const telefonoColumn = row[telefonoKey] || row['TELEFONO'] || row['TELÉFONO'] || row['telefono'] || '';
      
      // Limpiar el DNI (quitar comillas, comas y espacios)
      const dniLimpio = dniColumn ? String(dniColumn).replace(/[\s",]/g, '') : '';
      
      return {
        nombre: nombreColumn || '',
        dni: dniLimpio,
        domicilio: direccionColumn || '',
        telefono: telefonoColumn || ''
      };
    }).filter(cliente => cliente.dni && cliente.dni.trim() !== '');
    
    console.log(`CSV de clientes normalizado con éxito: ${clientesData.length} registros`);
    
    // Mostrar los primeros 3 registros para depuración
    if (clientesData.length > 0) {
      console.log('Primeros registros normalizados:', clientesData.slice(0, 3));
    }
  } catch (error) {
    console.error('Error al cargar el CSV de clientes:', error);
  }
}

// Ruta principal para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Endpoint mejorado para buscar cliente por DNI
app.get('/api/cliente/:dni', (req, res) => {
  const { dni } = req.params;
  
  if (!dni) {
    return res.status(400).json({ error: 'Se requiere un DNI para la búsqueda' });
  }
  
  console.log(`Buscando cliente con DNI: ${dni}`);
  
  // Normalizar el DNI para la búsqueda (eliminar puntos, comas, espacios, etc.)
  const dniNormalizado = String(dni).replace(/[\s,.]/g, '').trim();
  
  // Buscar cliente por DNI normalizado
  const cliente = clientesData.find(c => {
    // Normalizar el DNI del cliente en la lista también para comparar
    const clienteDniNormalizado = String(c.dni).replace(/[\s,.]/g, '').trim();
    return clienteDniNormalizado === dniNormalizado;
  });
  
  if (!cliente) {
    console.log(`No se encontró cliente con DNI: ${dni}`);
    return res.status(404).json({ error: 'No se encontró ningún cliente con ese DNI' });
  }
  
  console.log(`Cliente encontrado:`, cliente);
  return res.json(cliente);
});

// Verificador de archivos para comprobar que el logo existe
app.get('/api/check-logo', (req, res) => {
  const logoPath = path.join(imagesDir, 'logo.png');
  const exists = fs.existsSync(logoPath);
  
  const response = {
    exists,
    path: logoPath,
    files: exists ? [] : fs.readdirSync(imagesDir)
  };
  
  res.json(response);
});

// Ruta para crear un PDF basado en un diseño y variables
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { template, variables, options } = req.body;
    
    if (!template || !variables) {
      return res.status(400).json({ error: 'Se requiere un template y variables' });
    }
    
    // Generar nombre único para el archivo
    const filename = `${uuidv4()}.pdf`;
    const outputPath = path.join(tmpDir, filename);
    
    console.log(`Generando PDF con template: ${template}`);
    console.log(`Ruta de salida: ${outputPath}`);
    
    // Generar el PDF con original y duplicado
    if (template === 'reciboCiudadMotors') {
      await generateCiudadMotorsReceipt(variables, options, outputPath);
    } else {
      // Crear el PDF estándar
      await generatePDF(template, variables, options, outputPath);
    }
    
    if (!fs.existsSync(outputPath)) {
      throw new Error(`El archivo PDF no se generó correctamente: ${outputPath}`);
    }
    
    // Verificar el tamaño del archivo
    const stats = fs.statSync(outputPath);
    console.log(`Archivo generado: ${outputPath} (${stats.size} bytes)`);
    
    if (stats.size === 0) {
      throw new Error('El archivo PDF generado está vacío');
    }
    
    // Enviar el PDF como respuesta
    res.download(outputPath, `Recibo_${variables.numeroRecibo || 'CiudadMotors'}.pdf`, (err) => {
      if (err) {
        console.error('Error al enviar el archivo:', err);
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Error al generar el PDF' });
        }
      }
      
      // Eliminar el archivo temporal después de enviarlo
      fs.unlink(outputPath, (unlinkErr) => {
        if (unlinkErr) console.error('Error al eliminar archivo temporal:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: `Error al procesar la solicitud: ${error.message}` });
  }
});

// Función para generar recibo de Ciudad Motors con Original y Duplicado
async function generateCiudadMotorsReceipt(variables, options = {}, outputPath) {
  // Generar los PDFs individuales (original y duplicado)
  const originalPath = path.join(tmpDir, `original-${uuidv4()}.pdf`);
  const duplicatePath = path.join(tmpDir, `duplicado-${uuidv4()}.pdf`);
  
  console.log('Generando recibo original:', originalPath);
  console.log('Generando recibo duplicado:', duplicatePath);
  
  try {
    // Crear recibo original
    await generateSingleReceipt(variables, 'ORIGINAL', originalPath);
    
    // Crear recibo duplicado
    await generateSingleReceipt(variables, 'DUPLICADO', duplicatePath);
    
    // Combinar ambos PDFs en uno solo
    await mergePDFs([originalPath, duplicatePath], outputPath);
    
    // Eliminar los archivos temporales individuales
    if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
    if (fs.existsSync(duplicatePath)) fs.unlinkSync(duplicatePath);
    
    return outputPath;
  } catch (error) {
    console.error('Error al generar recibo:', error);
    // Limpiar archivos temporales en caso de error
    if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
    if (fs.existsSync(duplicatePath)) fs.unlinkSync(duplicatePath);
    throw error;
  }
}

// Función para generar un solo recibo (original o duplicado)
async function generateSingleReceipt(variables, type, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Generar QR code
      const qrCodePath = path.join(tmpDir, `qr-${uuidv4()}.png`);
      await generateQRCode('https://ciudadmotorscba.com', qrCodePath);
      
      console.log(`QR code generado: ${qrCodePath}`);
      
      // Crear un nuevo documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Recibo de Pago - Ciudad Motors - ${type}`,
          Author: 'Ciudad Motors',
          Subject: 'Recibo de Pago',
          Keywords: 'recibo, pago, ciudad motors'
        }
      });
      
      // Pipe el PDF a un archivo
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Renderizar el recibo
      renderCiudadMotorsReceipt(doc, variables, type, qrCodePath);
      
      // Finalizar el documento
      doc.end();
      
      // Manejar eventos de stream
      stream.on('finish', () => {
        console.log(`Recibo ${type} finalizado: ${outputPath}`);
        // Eliminar el QR temporal
        if (fs.existsSync(qrCodePath)) fs.unlinkSync(qrCodePath);
        resolve(outputPath);
      });
      
      stream.on('error', (error) => {
        console.error(`Error en stream al generar recibo ${type}:`, error);
        if (fs.existsSync(qrCodePath)) fs.unlinkSync(qrCodePath);
        reject(error);
      });
    } catch (error) {
      console.error(`Error al generar recibo ${type}:`, error);
      reject(error);
    }
  });
}

// Función para generar QR code
function generateQRCode(text, outputPath) {
  return new Promise((resolve, reject) => {
    qrcode.toFile(outputPath, text, {
      color: {
        dark: '#000',
        light: '#fff'
      },
      width: 150,
      errorCorrectionLevel: 'H'
    }, (err) => {
      if (err) {
        console.error('Error al generar QR code:', err);
        reject(err);
      } else {
        resolve(outputPath);
      }
    });
  });
}

// Función para combinar múltiples PDFs en uno solo
async function mergePDFs(pdfPaths, outputPath) {
  try {
    console.log('Combinando PDFs:', pdfPaths);
    
    // Verificar que todos los PDFs existen
    for (const pdfPath of pdfPaths) {
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`El archivo PDF no existe: ${pdfPath}`);
      }
    }
    
    // Crear un nuevo documento PDF
    const mergedPdf = await PDFLib.create();
    
    // Agregar cada PDF al documento combinado
    for (const pdfPath of pdfPaths) {
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdf = await PDFLib.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }
    
    // Guardar el PDF combinado
    const mergedPdfBytes = await mergedPdf.save();
    fs.writeFileSync(outputPath, mergedPdfBytes);
    
    console.log(`PDF combinado guardado en: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('Error al combinar PDFs:', error);
    throw error;
  }
}

// Función para renderizar el recibo de Ciudad Motors con total corregido
function renderCiudadMotorsReceipt(doc, variables, type, qrCodePath) {
    // Extraer variables
    const {
      numeroRecibo,
      fechacomprobante,
      metododePago,
      nombreCliente,
      clienteDomicilio,
      clienteDni,
      clienteTelefono,
      notas,
      cantCuotasPagas,
      valorCuota,
      totalPagadocuota,
      cantidadcuotasseguro,
      SeguroCuota,
      totalPgadoSeguro,
      interesgenerado,
      totalinteres,
      totalPagadofinal,
      numeroCuota // Variable para número de cuota
    } = variables;
    
    // Dimensiones de la página
    const pageWidth = doc.page.width;
    const pageMargin = 40;
    const contentWidth = pageWidth - (pageMargin * 2);
    
    // Logo y marca de agua
    const logoPath = path.join(imagesDir, 'logo.png');
    console.log(`Buscando logo en: ${logoPath}`);
    
    // Cabecera del recibo
    doc.fontSize(16)
       .fillColor('#444444')
       .text('RECIBO DE PAGO', pageMargin, 30, { align: 'center', width: contentWidth });
    
    // Tipo de documento (ORIGINAL o DUPLICADO)
    doc.fontSize(12)
       .text(type, pageMargin, 50, { align: 'center', width: contentWidth });
    
    // Número de recibo y fecha en la esquina superior derecha
    doc.fontSize(10)
       .text('RECIBO N', 430, 25, { align: 'left' });
    doc.fontSize(10)
       .text(numeroRecibo || '1231/23/12', 430, 40, { align: 'left' });
    
    doc.fontSize(10)
       .text('Fecha:', 430, 55, { align: 'left' });
    doc.fontSize(10)
       .text(fechacomprobante || '2025-04-04', 470, 55, { align: 'left' });
    
    doc.fontSize(10)
       .text('Córdoba Av. Maipú 347', 430, 70, { align: 'left' });
    
    // Logo en la esquina superior izquierda - con manejo de errores mejorado
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 25, { width: 100 });
        console.log('Logo cargado correctamente');
      } else {
        console.warn(`Logo no encontrado en: ${logoPath}`);
      }
    } catch (error) {
      console.error('Error al cargar el logo:', error.message);
    }
    
    // Marca de agua del logo en el fondo - con manejo de errores mejorado
    try {
      if (fs.existsSync(logoPath)) {
        doc.save(); // Guardar el estado actual
        doc.opacity(0.05); // Hacer el logo muy transparente
        
        // Colocar el logo como marca de agua en el centro
        doc.image(logoPath, pageWidth/2 - 150, 320, { 
          width: 300
        });
        
        doc.restore(); // Restaurar el estado (volver a opacidad normal)
      }
    } catch (error) {
      console.error('Error al usar el logo como marca de agua:', error.message);
    }
    
    // Línea divisoria
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(pageMargin, 95)
       .lineTo(pageWidth - pageMargin, 95)
       .stroke();
    
    // Información del cliente (primer recuadro)
    doc.roundedRect(pageMargin, 105, contentWidth, 70, 3)
       .lineWidth(1)
       .stroke();
    
    doc.fontSize(10)
       .fillColor('#000000');
       
    // Primera línea: Nombre cliente
    doc.text(nombreCliente || 'Eber Louza XD', pageMargin + 10, 115);
    
    // Segunda línea: Método de pago
    doc.text(`MÉTODO DE PAGO: ${metododePago || 'tarjeta'}`, pageMargin + 10, 130);
    
    // Tercera línea: DNI, DOMICILIO en 2 columnas
    doc.text(`DNI: ${clienteDni || '456634534'}`, pageMargin + 10, 145);
    doc.text(`DOMICILIO: ${clienteDomicilio || 'Santa Rosa 1851'}`, pageMargin + 210, 145);
    
    // Cuarta línea: Teléfono
    doc.text(`TELÉFONO: ${clienteTelefono || '351231234'}`, pageMargin + 10, 160);
    
    // Información de la empresa (segundo recuadro)
    doc.roundedRect(pageMargin, 185, contentWidth, 80, 3)
       .stroke();
    
    // Primera línea: Nombre empresa
    doc.fontSize(10)
       .text('ZAMBRANO RAMIREZ SAS', pageMargin + 10, 195);
    
    // Segunda línea: CUIT
    doc.text('CUIT: 30-71771470-5', pageMargin + 10, 210);
    
    // Tercera línea: Domicilio comercial
    doc.text('DOMICILIO COMERCIAL: Av. Maipú 347, Córdoba', pageMargin + 10, 225);
    
    // Cuarta línea: Condición frente al IVA
    doc.text('CONDICIÓN FRENTE AL IVA: IVA Responsable Inscripto', pageMargin + 10, 240);
    
    // Quinta línea: Ingresos brutos e Inicio actividad
    doc.text('INGRESOS BRUTOS: 287090188', pageMargin + 10, 255);
    doc.text('INICIO DE ACTIVIDAD: 01/06/2022', pageMargin + 300, 255);
    
    // Tabla de items
    const tableTop = 285;
    
    // Coordenadas corregidas para los encabezados de tabla
    const colNo = pageMargin + 5;
    const colDescripcion = colNo + 25;
    const colCuotaNum = pageMargin + 240;  // Ajustado más a la izquierda
    const colPrecioUnit = pageMargin + 320; // Ajustado más a la izquierda
    const colTotal = pageMargin + 450;      // Ajustado más a la izquierda
    
    doc.fontSize(10)
       .text('No.', colNo, tableTop)
       .text('DESCRIPCIÓN', colDescripcion, tableTop)
       .text('CUOTA N°', colCuotaNum, tableTop)
       .text('PRECIO UNITARIO', colPrecioUnit, tableTop)
       .text('TOTAL', colTotal, tableTop);
    
    // Línea debajo de los encabezados
    doc.lineWidth(0.5)
       .moveTo(pageMargin, tableTop + 15)
       .lineTo(pageWidth - pageMargin, tableTop + 15)
       .stroke();
    
    // Filas de la tabla con más espaciado entre ellas
    let y = tableTop + 25;
    
    // Fila 1 - Cuota Plan Ciudad Motors
    doc.fontSize(10)
       .text('1', colNo, y)
       .fillColor('#002e5d')
       .text('Cuota Ciudad Motors', colDescripcion, y);
    
    doc.fillColor('#000000')
       .text(numeroCuota || cantCuotasPagas || '1', colCuotaNum, y)  // Alineación izquierda
       .text(valorCuota || '46782', colPrecioUnit, y)  // Alineación izquierda
       .text(`${totalPagadocuota || '46782.00'}`, colTotal, y);  // Alineación izquierda
    
    // Fila 2 - Seguro
    y += 25; // Aumentar espacio entre filas
    doc.fontSize(10)
       .text('1', colNo, y)
       .fillColor('#A52A2A')
       .text('Seguro', colDescripcion, y);
    
    doc.fillColor('#000000')
       .text(cantidadcuotasseguro || '1', colCuotaNum, y)  // Alineación izquierda
       .text(SeguroCuota || '45672', colPrecioUnit, y)  // Alineación izquierda
       .text(`${totalPgadoSeguro || '45672.00'}`, colTotal, y);  // Alineación izquierda
    
    // Fila 3 - Interés
    y += 25; // Aumentar espacio entre filas
    doc.fontSize(10)
       .text('1', colNo, y)
       .fillColor('#000000')
       .text('Interés', colDescripcion, y);
    
    doc.text('', colCuotaNum, y)  // Campo vacío para cuota N°
       .text(interesgenerado || '12342', colPrecioUnit, y)  // Alineación izquierda
       .text(`${totalinteres || '12342.00'}`, colTotal, y);  // Alineación izquierda
    
    // Línea después de los items
    y += 30; // Espacio antes de la línea
    doc.lineWidth(0.5)
       .moveTo(pageMargin, y)
       .lineTo(pageWidth - pageMargin, y)
       .stroke();
    
    // Sección de Notas (recuadro azul claro)
    y += 20; // Espacio después de la línea
    doc.roundedRect(pageMargin, y, 250, 80, 3)
       .fillAndStroke('#E6F2FF', '#CCCCCC');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .text('Notas:', pageMargin + 10, y + 10);
    
    doc.fontSize(10)
       .text(notas || 'eee', pageMargin + 10, y + 30);
    
    // SECCIÓN DE TOTAL CORREGIDA
    const totalBoxY = y;
    
    // Crear un recuadro para el total
    doc.rect(pageWidth - pageMargin - 210, totalBoxY, 210, 80)
       .stroke();
    
    // Texto "Total:" alineado a la izquierda dentro del recuadro
    doc.fontSize(12)
       .fillColor('#000000')
       .text('Total:', pageWidth - pageMargin - 200, totalBoxY + 10);
    
    // Mostrar el valor del total formateado y alineado correctamente
    const totalValue = parseFloat(totalPagadofinal) || 0;
    const formattedTotal = `$ ${totalValue.toFixed(2)}`;
    
    // Mostrar el total con un tamaño de fuente más grande y alineado correctamente
    doc.fontSize(14)
       .text(formattedTotal, pageWidth - pageMargin - 200, totalBoxY + 30, { width: 190, align: 'right' });
    
    // Firma - separar MEDINA y Shirley
    doc.fontSize(10)
       .text('MEDINA', pageWidth - pageMargin - 100, y + 50, { align: 'center' });
    
    doc.fillColor('#0000FF')
       .text('Shirley', pageWidth - pageMargin - 100, y + 62, { align: 'center' });
    
    // Espacio para el pie de página
    y += 160;
    
    // Sección inferior con QR code y mensaje
    doc.fillColor('#000066')
       .rect(pageMargin, y, contentWidth, 35)
       .fill();
    
    // QR code en la parte inferior izquierda
    try {
      if (fs.existsSync(qrCodePath)) {
        doc.image(qrCodePath, pageMargin + 10, y + 2.5, { width: 30 });
      } else {
        console.warn(`QR code no encontrado en: ${qrCodePath}`);
      }
    } catch (error) {
      console.error('Error al incluir el QR code:', error.message);
    }
    
    // Mensaje en la parte inferior
    doc.fillColor('#FFFFFF')
       .fontSize(10)
       .text('Gracias por confiar en Ciudad Motors Cba', pageMargin + 50, y + 10, { align: 'center', width: contentWidth - 60 });
    
    doc.fontSize(8)
       .text('cobranzas@ciudadmotorscba.com', pageMargin + 50, y + 22, { align: 'center', width: contentWidth - 60 });
}

// Función para generar el PDF según el diseño y variables (para otras plantillas)
async function generatePDF(template, variables, options = {}, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Crear un nuevo documento PDF
      const doc = new PDFDocument({
        size: options.size || 'A4',
        margin: options.margin || 50,
        info: {
          Title: options.title || 'Documento PDF',
          Author: options.author || 'PDF API',
          Subject: options.subject || '',
          Keywords: options.keywords || '',
        }
      });
      
      // Pipe el PDF a un archivo
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      console.log(`Generando PDF con template: ${template}`);
      
      // Renderizar el PDF según el template seleccionado
      switch (template) {
        case 'factura':
          renderInvoiceTemplate(doc, variables, options);
          break;
        case 'certificado':
          renderCertificateTemplate(doc, variables, options);
          break;
        case 'carta':
          renderLetterTemplate(doc, variables, options);
          break;
        case 'reporte':
          renderReportTemplate(doc, variables, options);
          break;
        default:
          renderCustomTemplate(doc, variables, options);
      }
      
      // Finalizar el documento
      doc.end();
      
      // Manejar eventos de stream
      stream.on('finish', () => {
        console.log(`PDF generado correctamente: ${outputPath}`);
        resolve(outputPath);
      });
      
      stream.on('error', (error) => {
        console.error('Error en el stream al generar PDF:', error);
        reject(error);
      });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

// Template para facturas
function renderInvoiceTemplate(doc, variables, options) {
  const {
    companyName,
    companyAddress,
    clientName,
    clientAddress,
    invoiceNumber,
    date,
    dueDate,
    items,
    taxRate,
    notes
  } = variables;
  
  // Encabezado
  doc.fontSize(20).text(companyName || 'Empresa', { align: 'right' });
  doc.fontSize(10).text(companyAddress || 'Dirección empresa', { align: 'right' });
  doc.moveDown(2);
  
  // Información del cliente
  doc.fontSize(12).text('FACTURAR A:', { underline: true });
  doc.fontSize(10).text(clientName || 'Cliente');
  doc.text(clientAddress || 'Dirección cliente');
  doc.moveDown();
  
  // Detalles de la factura
  doc.fontSize(12).text('DETALLES DE LA FACTURA:', { underline: true });
  doc.fontSize(10).text(`Número de Factura: ${invoiceNumber || 'XXX-0001'}`);
  doc.text(`Fecha de Emisión: ${date || new Date().toLocaleDateString()}`);
  doc.text(`Fecha de Vencimiento: ${dueDate || new Date().toLocaleDateString()}`);
  doc.moveDown(2);
  
  // Tabla de productos
  const tableTop = doc.y;
  const itemCodeX = 50;
  const descriptionX = 100;
  const quantityX = 350;
  const priceX = 400;
  const amountX = 450;
  
  doc.fontSize(10)
     .text('Código', itemCodeX, tableTop)
     .text('Descripción', descriptionX, tableTop)
     .text('Cant.', quantityX, tableTop)
     .text('Precio', priceX, tableTop)
     .text('Total', amountX, tableTop);
  
  doc.moveTo(50, tableTop + 20)
     .lineTo(550, tableTop + 20)
     .stroke();
  
  let y = tableTop + 30;
  let subtotal = 0;
  
  // Agregar items a la tabla
  if (items && Array.isArray(items)) {
    items.forEach(item => {
      const itemTotal = (item.quantity || 0) * (item.price || 0);
      subtotal += itemTotal;
      
      doc.fontSize(10)
         .text(item.code || '', itemCodeX, y)
         .text(item.description || '', descriptionX, y)
         .text(item.quantity || '0', quantityX, y)
         .text(`${(item.price || 0).toFixed(2)}`, priceX, y)
         .text(`${itemTotal.toFixed(2)}`, amountX, y);
      
      y += 20;
    });
  }
  
  // Línea final de la tabla
  doc.moveTo(50, y)
     .lineTo(550, y)
     .stroke();
  
  // Calcular totales
  const tax = subtotal * ((taxRate || 0) / 100);
  const total = subtotal + tax;
  
  y += 20;
  doc.fontSize(10)
     .text('Subtotal:', 350, y)
     .text(`${subtotal.toFixed(2)}`, amountX, y);
  
  y += 20;
  doc.text(`IVA (${taxRate || 0}%):`, 350, y)
     .text(`${tax.toFixed(2)}`, amountX, y);
  
  y += 20;
  doc.fontSize(12)
     .text('Total:', 350, y)
     .text(`${total.toFixed(2)}`, amountX, y);
  
  // Notas
  if (notes) {
    doc.moveDown(2);
    doc.fontSize(10).text('Notas:', 50);
    doc.text(notes);
  }
}

// Template para certificados
function renderCertificateTemplate(doc, variables, options) {
  const {
    title,
    recipientName,
    issuerName,
    issuerPosition,
    description,
    date,
    logo
  } = variables;
  
  // Configurar la orientación horizontal si se especifica
  if (options && options.landscape) {
    doc.page.width = 841.89;
    doc.page.height = 595.28;
  }
  
  // Centrar todo el contenido
  const centerX = doc.page.width / 2;
  
  // Agregar logo si existe
  if (logo && fs.existsSync(logo)) {
    doc.image(logo, centerX - 50, 50, { width: 100, align: 'center' });
    doc.moveDown(2);
  }
  
  // Título del certificado
  doc.fontSize(24)
     .fillColor('#000066')
     .text(title || 'CERTIFICADO', { align: 'center' });
  doc.moveDown();
  
  // Línea decorativa
  doc.moveTo(100, doc.y)
     .lineTo(doc.page.width - 100, doc.y)
     .lineWidth(1)
     .strokeColor('#000066')
     .stroke();
  doc.moveDown(2);
  
  // Cuerpo del certificado
  doc.fontSize(14)
     .fillColor('#000')
     .text('Este certificado es otorgado a:', { align: 'center' });
  doc.moveDown();
  
  // Nombre del receptor (destacado)
  doc.fontSize(24)
     .fillColor('#000066')
     .text(recipientName || 'NOMBRE DEL RECEPTOR', { align: 'center' });
  doc.moveDown(2);
  
  // Descripción
  doc.fontSize(12)
     .fillColor('#000')
     .text(description || 'Descripción del certificado', { align: 'center' });
  doc.moveDown(2);
  
  // Fecha
  doc.fontSize(12)
     .text(`Otorgado el ${date || new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(4);
  
  // Firma
  doc.fontSize(12)
     .text('__________________________', { align: 'center' });
  doc.fontSize(12)
     .text(issuerName || 'Nombre de quien otorga', { align: 'center' });
  doc.fontSize(10)
     .text(issuerPosition || 'Cargo', { align: 'center' });
}

// Template para cartas
function renderLetterTemplate(doc, variables, options) {
  const {
    senderName,
    senderAddress,
    recipientName,
    recipientAddress,
    date,
    subject,
    content,
    signature,
    letterhead
  } = variables;
  
  // Agregar membrete si existe
  if (letterhead && fs.existsSync(letterhead)) {
    doc.image(letterhead, 50, 50, { width: 500 });
    doc.moveDown(4);
  } else {
    // Información del remitente
    doc.fontSize(12).text(senderName || 'Remitente');
    doc.fontSize(10).text(senderAddress || 'Dirección remitente');
    doc.moveDown(2);
  }
  
  // Fecha
  doc.fontSize(10).text(date || new Date().toLocaleDateString(), { align: 'right' });
  doc.moveDown();
  
  // Información del destinatario
  doc.fontSize(10).text(recipientName || 'Destinatario');
  doc.text(recipientAddress || 'Dirección destinatario');
  doc.moveDown(2);
  
  // Asunto
  if (subject) {
    doc.fontSize(12).text(`Asunto: ${subject}`, { underline: true });
    doc.moveDown();
  }
  
  // Cuerpo de la carta
  doc.fontSize(11).text(content || 'Contenido de la carta');
  doc.moveDown(2);
  
  // Despedida y firma
  doc.fontSize(11).text('Atentamente,', 400);
  doc.moveDown();
  
  // Agregar imagen de firma si existe
  if (signature && fs.existsSync(signature)) {
    doc.image(signature, 400, doc.y, { width: 100 });
    doc.moveDown();
  }
  
  doc.fontSize(11).text(senderName || 'Remitente', 400);
}

// Template para reportes (usando un diseño diferente)
function renderReportTemplate(doc, variables, options) {
  const {
    title,
    subtitle,
    author,
    date,
    sections,
    logo
  } = variables;
  
  // Agregar logo si existe
  if (logo && fs.existsSync(logo)) {
    doc.image(logo, 50, 45, { width: 60 });
  }
  
  // Título y subtítulo
  doc.fontSize(22)
     .fillColor('#000066')
     .text(title || 'REPORTE', 120, 50);
     
  if (subtitle) {
    doc.fontSize(14)
       .fillColor('#666666')
       .text(subtitle, 120, 75);
  }
  
  // Autor y fecha
  doc.fontSize(10)
     .fillColor('#000000')
     .text(`Autor: ${author || 'N/A'}`, 400, 50)
     .text(`Fecha: ${date || new Date().toLocaleDateString()}`, 400, 65);
  
  // Línea divisoria
  doc.moveTo(50, 100)
     .lineTo(550, 100)
     .lineWidth(1)
     .strokeColor('#CCCCCC')
     .stroke();
  
  let y = 120;
  
  // Secciones del reporte
  if (sections && Array.isArray(sections)) {
    sections.forEach(section => {
      // Título de sección
      doc.fontSize(16)
         .fillColor('#000066')
         .text(section.title || 'Sección sin título', 50, y);
      y += 25;
      
      // Contenido de la sección
      doc.fontSize(11)
         .fillColor('#000000')
         .text(section.content || 'Sin contenido', 50, y, {
           width: 500,
           align: 'justify'
         });
      
      // Calcular altura del texto para posicionar correctamente
      const textHeight = doc.heightOfString(section.content || 'Sin contenido', {
        width: 500,
        align: 'justify'
      });
      
      y += textHeight + 30; // Espacio entre secciones
      
      // Agregar imagen si existe
      if (section.image && fs.existsSync(section.image)) {
        doc.image(section.image, 50, y, { width: 400 });
        y += 250; // Espacio después de imagen
      }
      
      // Saltar a nueva página si es necesario
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    });
  }
}

// Template para diseños personalizados básico
function renderCustomTemplate(doc, variables, options) {
  const { title, content } = variables;
  
  // Título
  doc.fontSize(24).text(title || 'Título del documento', { align: 'center' });
  doc.moveDown(2);
  
  // Contenido
  doc.fontSize(12).text(content || 'Contenido del documento');
}

// Cargar el CSV al iniciar el servidor
cargarCSVClientes();

// Recargar datos de clientes cada 5 minutos (por si se actualiza el CSV)
setInterval(cargarCSVClientes, 5 * 60 * 1000);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`API de generación de PDFs iniciada en el puerto ${PORT}`);
  console.log(`Directorio base: ${baseDir}`);
  console.log(`Directorio público: ${publicDir}`);
  console.log(`Directorio de imágenes: ${imagesDir}`);
  console.log(`Directorio de datos: ${dataDir}`);
  console.log(`Directorio temporal: ${tmpDir}`);
});

module.exports = app;