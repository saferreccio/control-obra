# Control de Obra

App para llevar el control de gastos y entregas durante la construcción de una casa.

## Características

- 📊 Registro de gastos y entregas
- 💵 Dolarización automática (convierte ARS a USD)
- 📥 Exportación a Excel
- 💾 Guardado automático en el navegador
- 📱 Responsive (funciona en celular y desktop) 

## Uso

### Desarrollo local

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

### Build para producción

```bash
npm run build
```

## Deploy en GitHub Pages

Este proyecto está configurado para deployarse automáticamente en GitHub Pages.

### Configuración inicial

1. Ir a Settings del repositorio
2. En el menú lateral, click en "Pages"
3. En "Source" seleccionar "GitHub Actions"
4. El deploy se ejecutará automáticamente con cada push a la rama main

La app estará disponible en: `https://saferreccio.github.io/control-obra/`
