// Guardar este archivo como check-files.js y ejecutarlo con node check-files.js
const fs = require('fs');
const path = require('path');

// Rutas absolutas correctas
const baseDir = __dirname;
console.log('Directorio base:', baseDir);

// Comprobar carpetas importantes
const directorios = [
  { nombre: 'tmp', ruta: path.join(baseDir, 'tmp') },
  { nombre: 'public', ruta: path.join(baseDir, 'public') },
  { nombre: 'public/images', ruta: path.join(baseDir, 'public', 'images') },
  { nombre: 'public/data', ruta: path.join(baseDir, 'public', 'data') }
];

console.log('\n=== VERIFICACIÓN DE DIRECTORIOS ===');
directorios.forEach(dir => {
  const existe = fs.existsSync(dir.ruta);
  console.log(`${dir.nombre}: ${dir.ruta} - ${existe ? 'EXISTE' : 'NO EXISTE'}`);
  if (!existe) {
    console.log(`  --> Creando directorio ${dir.ruta}`);
    try {
      fs.mkdirSync(dir.ruta, { recursive: true });
      console.log(`  --> Directorio creado correctamente`);
    } catch (error) {
      console.error(`  --> Error al crear directorio: ${error.message}`);
    }
  }
});

// Comprobar archivos importantes
const archivos = [
  { nombre: 'logo.png', ruta: path.join(baseDir, 'public', 'images', 'logo.png') },
  { nombre: 'clientes.csv', ruta: path.join(baseDir, 'public', 'data', 'clientes.csv') }
];

console.log('\n=== VERIFICACIÓN DE ARCHIVOS ===');
archivos.forEach(archivo => {
  const existe = fs.existsSync(archivo.ruta);
  console.log(`${archivo.nombre}: ${archivo.ruta} - ${existe ? 'EXISTE' : 'NO EXISTE'}`);
});

// Verificar permisos de escritura en directorios importantes
console.log('\n=== VERIFICACIÓN DE PERMISOS ===');
directorios.forEach(dir => {
  if (fs.existsSync(dir.ruta)) {
    try {
      const testFile = path.join(dir.ruta, 'test-permissions.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`${dir.nombre}: PERMISO DE ESCRITURA CORRECTO`);
    } catch (error) {
      console.error(`${dir.nombre}: ERROR DE PERMISOS - ${error.message}`);
    }
  }
});

// Si el archivo logo.png no existe, verificamos si hay otros archivos en la carpeta images
const imagesDir = path.join(baseDir, 'public', 'images');
if (fs.existsSync(imagesDir)) {
  console.log('\n=== ARCHIVOS EN DIRECTORIO IMAGES ===');
  try {
    const files = fs.readdirSync(imagesDir);
    files.forEach(file => {
      console.log(`- ${file}`);
    });
    
    if (files.length === 0) {
      console.log('No hay archivos en el directorio images');
    }
  } catch (error) {
    console.error(`Error al leer directorio images: ${error.message}`);
  }
}

// Si el archivo clientes.csv no existe, verificamos si hay otros archivos en la carpeta data
const dataDir = path.join(baseDir, 'public', 'data');
if (fs.existsSync(dataDir)) {
  console.log('\n=== ARCHIVOS EN DIRECTORIO DATA ===');
  try {
    const files = fs.readdirSync(dataDir);
    files.forEach(file => {
      console.log(`- ${file}`);
    });
    
    if (files.length === 0) {
      console.log('No hay archivos en el directorio data');
    }
  } catch (error) {
    console.error(`Error al leer directorio data: ${error.message}`);
  }
}