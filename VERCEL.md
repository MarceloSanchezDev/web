# Despliegue en Vercel

## Web (Vite + React)

1. Crear un proyecto nuevo e importar el repositorio.
2. Configurar **Root Directory** como `web`.
3. Vercel detectará Vite y usará `npm run build` con salida en `dist`.
4. No definir `VITE_API_URL` en producción para el dominio oficial. La web usa `/api`, que `vercel.json` reenvía al backend. Esto mantiene la cookie de sesión en el mismo origen y evita exponer el refresh token a JavaScript.
5. Desplegar. El archivo `vercel.json` contiene el proxy `/api`, las rutas de la SPA y las cabeceras de seguridad.

Si se cambia el dominio del backend, actualizar el destino del primer rewrite de `vercel.json`. `VITE_API_URL` solamente debe utilizarse para desarrollo o instalaciones con un proxy equivalente; nunca debe contener secretos.

## API

La API se despliega como un proyecto separado, con **Root Directory** `backend`. Configurar:

```text
DATABASE_URL=<PostgreSQL productivo>
JWT_SECRET=<secreto aleatorio de al menos 32 caracteres>
JWT_ISSUER=basket-staff-api
JWT_AUDIENCE=basket-staff-clients
REFRESH_TOKEN_DAYS=30
SESSION_ABSOLUTE_DAYS=90
CORS_ORIGINS=https://web-mauve-kappa-63.vercel.app,https://localhost
TRUST_PROXY=true
NODE_ENV=production
```

Desplegar primero el backend para aplicar las migraciones y después la web. Finalmente verificar `/health`, el login web, la renovación de sesión y un flujo autenticado.
