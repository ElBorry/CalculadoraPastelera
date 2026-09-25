# Calculadora de Pastelería V3

Aplicación web simple para calcular costos de recetas, rendimiento, presentación por unidad, precio sugerido y ganancia real.

## Funciones V3
- Ingredientes con conversión automática: g/kg, ml/l y unidad.
- Costo completo de la receta y costo de ingredientes por unidad.
- Rendimiento del lote.
- Presentación por unidad: caja, cinta, tarjeta, bandeja, bolsa y bebida.
- Costos personalizados por unidad.
- Mano de obra, gas/electricidad y otros costos del lote.
- Dos métodos de precio:
  - porcentaje de ganancia sobre costo real;
  - multiplicador sobre ingredientes (por ejemplo: ingredientes × 3 ÷ unidades).
- Ganancia real por unidad y por lote.
- Markup y margen sobre venta.
- Guardar, abrir, duplicar y eliminar recetas.
- Impresión / Guardar como PDF desde el navegador.
- Datos guardados localmente en el navegador.

## Ejecutar en Visual Studio Code

```bash
npm install
npm run dev
```

Abrir la URL que muestra Vite, normalmente `http://localhost:5173`.

## Importante
Los datos se guardan en `localStorage`, por lo que permanecen en ese navegador y dispositivo. Para sincronización entre dispositivos habría que agregar una base de datos en una versión futura.
