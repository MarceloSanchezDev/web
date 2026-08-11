# Despliegue en Vercel

## Web (Vite + React)

1. Crear un proyecto nuevo e importar el repositorio.
2. Configurar **Root Directory** como `web`.
3. Vercel detectará Vite y usará `npm run build` con salida en `dist`.
4. En **Settings → Environment Variables**, definir para Production y Preview:

   ```
   VITE_API_URL=https://TU-BACKEND.vercel.app
   ```

   `VITE_API_URL` es una URL pública: se incorpora al JavaScript del navegador. No colocar secretos en esa variable.
5. Desplegar. El archivo `vercel.json` permite abrir directamente cualquier ruta de la SPA.

## API

La API se despliega como un proyecto separado, con **Root Directory** `backend`. Configurar:

```text
DATABASE_URL=<PostgreSQL productivo>
JWT_SECRET=<secreto aleatorio de al menos 32 caracteres>
CORS_ORIGINS=https://TU-FRONTEND.vercel.app
NODE_ENV=production
```

Después del primer despliegue, verificar `https://TU-BACKEND.vercel.app/health` y volver a desplegar la web si cambió `VITE_API_URL`.
