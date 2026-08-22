const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Hospitalia Backend API",
      version: "1.0.0",
      description: "REST API for the Hospitalia healthcare frontend.",
    },
    servers: [
      {
        url: "http://localhost:5001",
        description: "Local development",
      },
      {
        url: "https://hospitalia-web-backend.vercel.app",
        description: "Production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            status: { type: "string", enum: ["success", "error"] },
            message: { type: "string" },
            payload: { nullable: true },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["countryCode", "phoneNumber", "password"],
          properties: {
            countryCode: { type: "string", example: "+880" },
            phoneNumber: { type: "string", example: "1711111111" },
            password: { type: "string", example: "Password123" },
          },
        },
        SpecialityInput: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Dermatology" },
            description: { type: "string", example: "Skin, hair and nail care" },
            status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
          },
        },
      },
    },
    paths: {
      "/api/auth/sign-in": {
        post: {
          tags: ["Auth"],
          summary: "Login with phone and password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: { 200: { description: "Login successful" } },
        },
      },
      "/api/auth/sign-up": {
        post: {
          tags: ["Auth"],
          summary: "Register patient or doctor",
          responses: { 201: { description: "Registered" } },
        },
      },
      "/api/admin/auth/sign-in": {
        post: {
          tags: ["Auth"],
          summary: "Admin login",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: { 200: { description: "Admin login successful" } },
        },
      },
      "/api/speciality/all": {
        get: {
          tags: ["Specialities"],
          summary: "List active specialities for doctor registration",
          security: [],
          responses: { 200: { description: "Specialities fetched" } },
        },
      },
      "/api/admin/speciality/create": {
        post: {
          tags: ["Specialities"],
          summary: "Create a speciality (admin authentication required)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SpecialityInput" } } },
          },
          responses: { 201: { description: "Speciality created" }, 401: { description: "Authentication required" } },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
});

const routeDocs = [
  ["Auth", "POST", "/api/auth/sign-up"],
  ["Auth", "POST", "/api/auth/hospital/sign-up"],
  ["Auth", "POST", "/api/auth/sign-in"],
  ["Auth", "GET", "/api/auth/sign-out"],
  ["Auth", "POST", "/api/auth/forgot-password"],
  ["Auth", "POST", "/api/auth/verify-otp"],
  ["Auth", "POST", "/api/auth/reset-password"],
  ["Users", "GET", "/api/users/me"],
  ["Doctors", "GET", "/api/doctors/paginated"],
  ["Doctors", "GET", "/api/doctors/id/{userId}"],
  ["Doctors", "GET", "/api/doctors/{doctorId}"],
  ["Doctors", "PUT", "/api/doctors/update"],
  ["Doctor Locations", "GET", "/api/doctors/location/all/{doctorId}"],
  ["Doctor Locations", "POST", "/api/doctors/location/create"],
  ["Doctor Locations", "PUT", "/api/doctors/location/update"],
  ["Availability", "GET", "/api/doctors/availability/all/doctorId/{doctorId}/status"],
  ["Availability", "GET", "/api/doctors/availability/all/doctorId/{doctorId}/location/{doctorLocationId}"],
  ["Availability", "POST", "/api/doctors/availability/create"],
  ["Appointments", "GET", "/api/appointments/available-slots/doctor/{doctorId}/doctor-location/{doctorLocationId}"],
  ["Appointments", "POST", "/api/appointments/book-appointment"],
  ["Appointments", "POST", "/api/appointments/staff/book-appointment"],
  ["Appointments", "GET", "/api/appointments/all/upcoming/doctorId/{doctorId}"],
  ["Appointments", "GET", "/api/appointments/all/upcoming/patientUserId/{patientUserId}"],
  ["Appointments", "PATCH", "/api/appointments/cancel-appointment/{appointmentId}"],
  ["Hospitals", "GET", "/api/hospitals/{id}"],
  ["Hospitals", "GET", "/api/hospitals/id/{hospitalUserId}"],
  ["Hospitals", "POST", "/api/hospitals/create"],
  ["Hospital Locations", "GET", "/api/hospitals/locations/hospital/{hospitalId}"],
  ["Hospital Doctors", "GET", "/api/hospital-doctors/hospital/{hospitalId}"],
  ["Patients", "GET", "/api/patients/id/{userId}"],
  ["Patients", "PUT", "/api/patients/update"],
  ["Patients", "GET", "/api/patients/search"],
  ["Secretaries", "POST", "/api/secretaries/create"],
  ["Secretaries", "GET", "/api/secretaries/doctorUserId/{doctorUserId}"],
  ["Search", "GET", "/api/global-search/search"],
  ["Search", "GET", "/api/global-search/cities/doctors"],
  ["Search", "GET", "/api/global-search/cities/hospitals"],
  ["Chat", "POST", "/api/chat/threads"],
  ["Chat", "POST", "/api/chat/threads/{threadId}/messages"],
  ["Chat", "GET", "/api/chat/threads/{threadId}/messages"],
];

for (const [tag, method, path] of routeDocs) {
  swaggerSpec.paths[path] = swaggerSpec.paths[path] || {};
  swaggerSpec.paths[path][method.toLowerCase()] = swaggerSpec.paths[path][method.toLowerCase()] || {
    tags: [tag],
    summary: `${method} ${path}`,
    security: method === "GET" && path.includes("global-search") ? [] : [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiResponse" },
          },
        },
      },
    },
  };
}

module.exports = swaggerSpec;

