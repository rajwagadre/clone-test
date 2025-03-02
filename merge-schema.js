const fs = require('fs');
const path = require('path');

// Define paths
const schemaPath = path.join(__dirname, 'app', 'prisma', 'schema.prisma');
const modelsPath = path.join(__dirname, 'app','prisma', 'models');

// Read the base schema file
let schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Append models from separate files
const modelFiles = fs.readdirSync(modelsPath);
modelFiles.forEach((file) => {
  if (file.endsWith('.prisma')) {
    const modelContent = fs.readFileSync(path.join(modelsPath, file), 'utf-8');
    schemaContent += '\n\n' + modelContent;
  }
});

// Write the merged schema back to schema.prisma
fs.writeFileSync(schemaPath, schemaContent);
console.log('Schema merged successfully!');
