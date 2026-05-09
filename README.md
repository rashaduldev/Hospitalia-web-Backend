# Hospitalia Backend

TypeScript Express + MongoDB backend for the existing Hospitalia Next.js frontend.

## Run locally

```bash
cd backend
npm install
cp .env.example .env
npm run seed
npm run dev
```

Build and run the compiled server:

```bash
npm run build
npm start
```

API base URL:

```text
http://localhost:5000
```

Swagger UI:

```text
http://localhost:5000/api-docs
```

Set the frontend `.env` value to:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Seed users

All seeded accounts use password `Password123`.

| User | Phone | Type |
| --- | --- | --- |
| Admin | `+8801700000000` | Admin |
| Doctor | `+8801711111111` | Doctor |
| Patient | `+8801722222222` | Patient |
| Hospital | `+8801733333333` | Hospital |
| Secretary | `+8801744444444` | Secretary |

Login payload example:

```json
{
  "countryCode": "+880",
  "phoneNumber": "1711111111",
  "password": "Password123"
}
```
