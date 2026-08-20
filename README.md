# Hospitalia Backend

Hospitalia Backend is the REST API for the Hospitalia healthcare platform. It provides the authentication, scheduling, appointment, provider, hospital, administration, and catalogue services consumed by Hospitalia Web.

## Mission and vision

**Mission:** provide a secure and consistent service layer that makes patient care workflows easier to build and operate.

**Vision:** support a connected healthcare ecosystem where patients, care providers, hospitals, and operations teams share reliable, well-governed data.

## Platform capabilities

- JWT-based authentication, role-aware access, logout, password reset, and OTP verification
- Patient, doctor, hospital, secretary, and administrator account management
- Doctor professional profiles, locations, availability, unavailable dates, and appointment types
- Patient self-booking and staff-assisted appointment workflows
- Hospital locations and doctor association management
- Search and discovery across doctors, hospitals, locations, and specialities
- Administrative users, roles, privileges, and speciality catalogue management
- Conversation threads and message attachments
- Swagger/OpenAPI documentation for API exploration and testing

## Architecture

```text
HTTP request
  -> Express application and security middleware
  -> Routes and authentication middleware
  -> Controllers and shared utilities
  -> Mongoose models
  -> MongoDB
```

| Layer | Responsibility |
| --- | --- |
| `src/config` | Environment loading and MongoDB connection. |
| `src/models` | Mongoose schemas for platform data. |
| `src/routes` | API route definitions grouped by domain. |
| `src/controllers` | Request validation, business workflows, and responses. |
| `src/middleware` | Authentication, error handling, and route protection. |
| `src/utils` | IDs, pagination, response formatting, and async helpers. |
| `src/docs` | Swagger/OpenAPI configuration. |
| `src/scripts` | Local demo-data seed script. |

## Technology

- Node.js 20+, TypeScript, and Express 4
- MongoDB and Mongoose
- JSON Web Tokens and bcryptjs
- Helmet, CORS, compression, request rate limiting, and Morgan logging
- Swagger UI and swagger-jsdoc

## Local development

### Prerequisites

- Node.js 20 or newer
- A MongoDB database or MongoDB Atlas connection string

### Configure environment

Create `.env` in this directory. Do not commit it.

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/hospitalia
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=3d
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

Install and start the API:

```bash
npm install
npm run dev
```

The server exposes:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Service health check. |
| `/api` | REST API base path. |
| `/api-docs` | Interactive Swagger UI. |
| `/api-docs.json` | OpenAPI specification. |

With the example configuration, Swagger UI is available at `http://localhost:5001/api-docs`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API with TypeScript file watching. |
| `npm run build` | Compile `src` into `dist`. |
| `npm run start` | Run the compiled production server. |
| `npm run seed` | Reset and load local demonstration data. **Do not use against production data.** |

## API conventions

Responses follow a common envelope:

```json
{
  "success": true,
  "status": "success",
  "message": "Human-readable result",
  "payload": {}
}
```

Protected routes require an access token:

```http
Authorization: Bearer <access-token>
```

Public doctor-registration clients can retrieve the active catalogue from `GET /api/speciality/all`. The backend bootstraps a small default speciality catalogue when needed. Administrators can add new entries using `POST /api/admin/speciality/create`, documented in Swagger.

## Production checklist

- Use a managed MongoDB deployment with backups, restricted network access, and a least-privilege database user.
- Supply long, unique JWT secrets; never use development defaults.
- Set `NODE_ENV=production` and a precise comma-separated `CORS_ORIGIN` allowlist.
- Run `npm run build` before deployment; it fails when TypeScript compilation fails.
- Serve behind TLS and configure monitoring, log retention, and health checks.
- Do not run the demo seed script in production.

## Frontend integration

Hospitalia Web lives in [`../hospitalia-web-frontend`](../hospitalia-web-frontend). Point its `.env` file at this API:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

## Contributing

1. Keep route, controller, model, Swagger, and frontend contract changes in sync.
2. Preserve the standard response envelope and clear HTTP status codes.
3. Add authentication and role checks to privileged operations.
4. Run `npm run build` and exercise affected routes before submitting a change.

## Author

Built and maintained by **Rashadul Dev**.

---

Hospitalia Backend is part of the Hospitalia healthcare platform.

