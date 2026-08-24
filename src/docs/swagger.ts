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
        PatientSignUpRequest: {
          type: "object",
          required: ["firstName", "gender", "userType", "email", "mobileNumber", "password"],
          properties: {
            firstName: { type: "string", example: "Amina" },
            lastName: { type: "string", example: "Rahman" },
            gender: { type: "string", enum: ["MALE", "FEMALE"], example: "FEMALE" },
            userType: { type: "string", enum: ["PATIENT"], example: "PATIENT" },
            email: { type: "string", format: "email", example: "amina@example.com" },
            dateOfBirth: { type: "string", format: "date", example: "1995-06-15" },
            countryCode: { type: "string", example: "+880", default: "+880" },
            mobileNumber: { type: "string", example: "1711111111" },
            password: { type: "string", format: "password", example: "Password123!" },
          },
        },
        DoctorSignUpRequest: {
          type: "object",
          required: ["firstName", "gender", "userType", "email", "mobileNumber", "password", "professionalInfoRequest"],
          properties: {
            firstName: { type: "string", example: "Karim" },
            lastName: { type: "string", example: "Hossain" },
            gender: { type: "string", enum: ["MALE", "FEMALE"], example: "MALE" },
            userType: { type: "string", enum: ["DOCTOR"], example: "DOCTOR" },
            email: { type: "string", format: "email", example: "karim@example.com" },
            dateOfBirth: { type: "string", format: "date", example: "1987-03-21" },
            countryCode: { type: "string", example: "+880", default: "+880" },
            mobileNumber: { type: "string", example: "1711111111" },
            password: { type: "string", format: "password", example: "Password123!" },
            professionalInfoRequest: {
              type: "object",
              required: ["designation", "specialityId", "onmsRegistrationNumber"],
              properties: {
                designation: { type: "string", example: "Consultant Cardiologist" },
                specialityId: { type: "array", minItems: 1, items: { type: "integer" }, example: [1] },
                onmsRegistrationNumber: { type: "string", example: "BMDC-A-12345" },
                professionalStatement: { type: "string", example: "Experienced in cardiovascular care." },
              },
            },
          },
        },
        HospitalSignUpRequest: {
          type: "object",
          required: ["hospitalName", "email", "mobileNumber", "password"],
          properties: {
            hospitalName: { type: "string", example: "Dhaka Medical Center" },
            email: { type: "string", format: "email", example: "admin@dhakamedical.example" },
            countryCode: { type: "string", example: "+880", default: "+880" },
            mobileNumber: { type: "string", example: "1711111111" },
            password: { type: "string", format: "password", example: "Password123!" },
          },
        },
        EmailRequest: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email", example: "user@example.com" } },
        },
        VerifyOtpRequest: {
          type: "object",
          required: ["email", "otp"],
          properties: {
            email: { type: "string", format: "email", example: "user@example.com" },
            otp: { type: "string", example: "123456" },
          },
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["email", "newPassword"],
          properties: {
            email: { type: "string", format: "email", example: "user@example.com" },
            newPassword: { type: "string", format: "password", example: "Password123!" },
          },
        },
        UserInput: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 }, firstName: { type: "string", example: "Amina" },
            lastName: { type: "string", example: "Rahman" }, email: { type: "string", format: "email" },
            countryCode: { type: "string", example: "+880" }, mobileNumber: { type: "string", example: "1711111111" },
            password: { type: "string", format: "password" }, userType: { type: "string", example: "PATIENT" },
            status: { type: "string", enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING", "INVITED"] },
          },
        },
        LocationInput: {
          type: "object",
          required: ["locationName"],
          properties: {
            id: { type: "integer", example: 1 }, doctorId: { type: "integer", example: 1 }, hospitalId: { type: "integer", example: 1 },
            locationName: { type: "string", example: "Dhanmondi Branch" }, address: { type: "string", example: "Road 27" },
            city: { type: "string", example: "Dhaka" }, country: { type: "string", example: "Bangladesh" },
            latitude: { type: "number", example: 23.7465 }, longitude: { type: "number", example: 90.376 }, fees: { type: "number", example: 800 }, active: { type: "boolean", example: true },
          },
        },
        DoctorInput: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "integer", example: 12 }, firstName: { type: "string" }, lastName: { type: "string" },
            gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] }, email: { type: "string", format: "email" },
            countryCode: { type: "string", example: "+880" }, mobileNumber: { type: "string", example: "1711111111" },
            professionalInfoRequest: { $ref: "#/components/schemas/ProfessionalInfoInput" },
          },
        },
        ProfessionalInfoInput: {
          type: "object",
          properties: {
            designation: { type: "string", example: "Consultant" }, specialityId: { type: "array", items: { type: "integer" }, example: [1] },
            onmsRegistrationNumber: { type: "string", example: "BMDC-A-12345" }, professionalStatement: { type: "string" }, workPhoneNumber: { type: "string" },
          },
        },
        AvailabilityInput: {
          type: "object",
          required: ["doctorId", "doctorLocationId", "dayOfWeek", "startTime", "endTime"],
          properties: {
            id: { type: "integer" }, doctorId: { type: "integer", example: 1 }, doctorLocationId: { type: "integer", example: 1 },
            dayOfWeek: { type: "string", example: "MONDAY" }, startTime: { type: "string", example: "09:00" }, endTime: { type: "string", example: "17:00" },
            slotDuration: { type: "integer", example: 30 }, fees: { type: "number", example: 800 }, status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
          },
        },
        AppointmentInput: {
          type: "object",
          required: ["doctorId", "appointmentDate", "appointmentSlotDto"],
          properties: {
            doctorId: { type: "integer", example: 1 }, patientUserId: { type: "integer", example: 21 }, appointmentTypeId: { type: "integer", example: 1 },
            appointmentDate: { type: "string", format: "date", example: "2026-08-30" }, patientName: { type: "string", example: "Amina Rahman" },
            patientGender: { type: "string", example: "FEMALE" }, patientAge: { type: "integer", example: 30 }, patientPhone: { type: "string" }, patientEmail: { type: "string", format: "email" },
            appointmentSlotDto: { type: "object", required: ["doctorLocationId", "startTime", "endTime"], properties: { doctorLocationId: { type: "integer", example: 1 }, startTime: { type: "string", example: "10:00" }, endTime: { type: "string", example: "10:30" } }, },
            notes: { type: "string" }, bookingSource: { type: "string", enum: ["PATIENT", "DOCTOR", "SECRETARY"] },
          },
        },
        HospitalInput: {
          type: "object",
          properties: {
            userId: { type: "integer", example: 5 }, hospitalName: { type: "string", example: "Dhaka Medical Center" }, hospitalType: { type: "string" },
            email: { type: "string", format: "email" }, countryCode: { type: "string", example: "+880" }, mobileNumber: { type: "string" },
            workPhoneNumber: { type: "string" }, websiteUrl: { type: "string", format: "uri" }, numberOfBeds: { type: "integer" }, foundedYear: { type: "integer" },
          },
        },
        RoleInput: {
          type: "object",
          required: ["roleName", "roleType"],
          properties: { id: { type: "integer" }, roleName: { type: "string", example: "DOCTOR" }, roleType: { type: "string", example: "DOCTOR" }, description: { type: "string" }, privileges: { type: "array", items: { type: "object" } } },
        },
        SecretaryInput: {
          type: "object",
          properties: { userId: { type: "integer" }, doctorUserId: { type: "integer" }, doctorId: { type: "integer" }, firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string", format: "email" }, phoneNumber: { type: "string" }, status: { type: "string", enum: ["PENDING", "INVITED", "ACTIVE"] } },
        },
        SecretaryLocationInput: {
          type: "object",
          required: ["userId", "locationId"],
          properties: { userId: { type: "integer" }, locationId: { type: "integer" }, doctorId: { type: "integer" }, locationName: { type: "string" }, city: { type: "string" } },
        },
        BeneficiaryInput: {
          type: "object",
          required: ["patientUserId"],
          properties: { patientUserId: { type: "integer" }, firstName: { type: "string" }, lastName: { type: "string" }, gender: { type: "string" }, relation: { type: "string" }, age: { type: "integer" }, mobileNumber: { type: "string" } },
        },
        UnavailabilityInput: {
          type: "object",
          required: ["doctorId", "unavailableDate"],
          properties: { id: { type: "integer" }, doctorId: { type: "integer" }, unavailableDate: { type: "string", format: "date" }, reason: { type: "string" }, status: { type: "string", enum: ["ACTIVE", "INACTIVE"] } },
        },
        ChatThreadInput: {
          type: "object",
          required: ["doctorUserId", "patientUserId"],
          properties: { doctorUserId: { type: "integer" }, patientUserId: { type: "integer" }, subject: { type: "string" } },
        },
        ChatMessageInput: {
          type: "object",
          properties: { senderUserId: { type: "integer" }, body: { type: "string", example: "Hello" }, attachmentUrl: { type: "string", format: "uri" }, file: { type: "string", format: "binary" } },
        },
        HospitalDoctorInput: {
          type: "object",
          required: ["hospitalId", "doctorId"],
          properties: { hospitalId: { type: "integer", example: 1 }, doctorId: { type: "integer", example: 1 } },
        },
        SearchInput: {
          type: "object",
          properties: { search: { type: "string", example: "cardiologist" }, city: { type: "string", example: "Dhaka" } },
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
          summary: "Register a patient or doctor",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/PatientSignUpRequest" },
                    { $ref: "#/components/schemas/DoctorSignUpRequest" },
                  ],
                },
              },
            },
          },
          responses: { 201: { description: "Registered" } },
        },
      },
      "/api/auth/hospital/sign-up": {
        post: {
          tags: ["Auth"],
          summary: "Register a hospital",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HospitalSignUpRequest" },
              },
            },
          },
          responses: { 201: { description: "Hospital registered" } },
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
  ["Auth", "POST", "/api/auth/sign-up"], ["Auth", "POST", "/api/auth/hospital/sign-up"], ["Auth", "POST", "/api/auth/sign-in"], ["Auth", "GET", "/api/auth/sign-out"], ["Auth", "POST", "/api/auth/forgot-password"], ["Auth", "POST", "/api/auth/verify-otp"], ["Auth", "POST", "/api/auth/reset-password"],
  ["Users", "GET", "/api/users/me"],
  ["Admin", "POST", "/api/admin/auth/sign-in"], ["Admin", "GET", "/api/admin/stats/dashboard"], ["Specialities", "GET", "/api/admin/speciality/all"], ["Specialities", "POST", "/api/admin/speciality/create"], ["Specialities", "PUT", "/api/admin/speciality/update/id/{id}"], ["Specialities", "DELETE", "/api/admin/speciality/delete/id/{id}"], ["Specialities", "GET", "/api/admin/speciality/id/{id}"],
  ["Admin Users", "GET", "/api/admin/users/paginated"], ["Admin Users", "GET", "/api/admin/users/id/{id}"], ["Admin Users", "POST", "/api/admin/users/create"], ["Admin Users", "PUT", "/api/admin/users/update"], ["Admin Users", "PATCH", "/api/admin/users/status/update"], ["Admin Users", "DELETE", "/api/admin/users/delete"],
  ["Roles", "GET", "/api/admin/roles/paginated"], ["Roles", "GET", "/api/admin/roles/id/{id}"], ["Roles", "GET", "/api/admin/roles/role-type/all"], ["Roles", "GET", "/api/admin/privileges"], ["Roles", "POST", "/api/admin/roles/create"], ["Roles", "PUT", "/api/admin/roles/update"], ["Roles", "DELETE", "/api/admin/roles/id/{id}/delete"],
  ["Doctors", "GET", "/api/doctors/paginated"], ["Doctors", "GET", "/api/doctors/id/{userId}"], ["Doctors", "GET", "/api/doctors/{doctorId}"], ["Doctors", "PUT", "/api/doctors/update"], ["Doctors", "PATCH", "/api/doctors/update"], ["Doctors", "GET", "/api/doctors/imported-by/{userId}"], ["Doctors", "GET", "/api/doctors/invitation/info"], ["Doctors", "POST", "/api/doctors/onboard"], ["Doctors", "POST", "/api/doctors/invite/{doctorId}"],
  ["Doctor Locations", "GET", "/api/doctors/location/all/{doctorId}"], ["Doctor Locations", "GET", "/api/doctors/location/{locationId}"], ["Doctor Locations", "POST", "/api/doctors/location/create"], ["Doctor Locations", "PUT", "/api/doctors/location/update"], ["Doctor Locations", "DELETE", "/api/doctors/location/delete/locationId/{locationId}/doctorId/{doctorId}"],
  ["Availability", "GET", "/api/doctors/availability/all/doctorId/{doctorId}/status"], ["Availability", "GET", "/api/doctors/availability/all/doctorId/{doctorId}/location/{doctorLocationId}"], ["Availability", "POST", "/api/doctors/availability/create"], ["Availability", "PUT", "/api/doctors/availability/update"], ["Availability", "DELETE", "/api/doctors/availability/{id}"], ["Availability", "GET", "/api/doctors/availability/time-slots/default"],
  ["Unavailability", "GET", "/api/doctors/unavailability/all/doctorId/{doctorId}"], ["Unavailability", "POST", "/api/doctors/unavailability/set"], ["Unavailability", "PUT", "/api/doctors/unavailability/update"], ["Unavailability", "DELETE", "/api/doctors/unavailability/{id}"],
  ["Appointments", "GET", "/api/appointments/available-slots/doctor/{doctorId}/doctor-location/{doctorLocationId}"], ["Appointments", "GET", "/api/appointments/type/all"], ["Appointments", "POST", "/api/appointments/book-appointment"], ["Appointments", "POST", "/api/appointments/staff/book-appointment"], ["Appointments", "GET", "/api/appointments/all/upcoming/doctorId/{doctorId}"], ["Appointments", "GET", "/api/appointments/all/today/doctorId/{doctorId}"], ["Appointments", "GET", "/api/appointments/all/past/doctorId/{doctorId}"], ["Appointments", "GET", "/api/appointments/all/upcoming/patientUserId/{patientUserId}"], ["Appointments", "GET", "/api/appointments/all/past/patientUserId/{patientUserId}"], ["Appointments", "GET", "/api/appointments/all/doctorId/{doctorId}/doctorLocationId/{locationId}"], ["Appointments", "GET", "/api/appointments/all/past/doctorId/{doctorId}/doctorLocationId/{locationId}"], ["Appointments", "GET", "/api/appointments/all/doctorId/{doctorId}/date/doctorLocationId/{locationId}"], ["Appointments", "PATCH", "/api/appointments/cancel-appointment/{appointmentId}"], ["Appointments", "PUT", "/api/appointments/cancel-appointment/{appointmentId}"],
  ["Hospitals", "GET", "/api/hospitals/locations/hospital/{hospitalId}"], ["Hospitals", "POST", "/api/hospitals/locations/create"], ["Hospitals", "PUT", "/api/hospitals/locations/update"], ["Hospitals", "DELETE", "/api/hospitals/locations/delete/{locationId}"], ["Hospitals", "GET", "/api/hospitals/public/{id}"], ["Hospitals", "GET", "/api/hospitals/id/{hospitalUserId}"], ["Hospitals", "GET", "/api/hospitals/paginated/user/{userId}"], ["Hospitals", "POST", "/api/hospitals/create"], ["Hospitals", "PUT", "/api/hospitals/update/{id}"], ["Hospitals", "DELETE", "/api/hospitals/delete/id/{id}"], ["Hospitals", "GET", "/api/hospitals/{id}"],
  ["Hospital Doctors", "GET", "/api/hospital-doctors/hospital/{hospitalId}"], ["Hospital Doctors", "POST", "/api/hospital-doctors/assign"], ["Hospital Doctors", "DELETE", "/api/hospital-doctors/unassign/{id}"],
  ["Patients", "GET", "/api/patients/id/{userId}"], ["Patients", "PUT", "/api/patients/update"], ["Patients", "PATCH", "/api/patients/update"], ["Patients", "GET", "/api/patients/search"], ["Beneficiaries", "GET", "/api/patients/beneficiary/paginated"], ["Beneficiaries", "POST", "/api/patients/beneficiary/add"], ["Beneficiaries", "DELETE", "/api/patients/beneficiary/delete/{id}"],
  ["Secretaries", "POST", "/api/secretaries/create"], ["Secretaries", "POST", "/api/secretaries/invite/{secretaryUserId}"], ["Secretaries", "POST", "/api/secretaries/resend-invitation/{secretaryUserId}"], ["Secretaries", "GET", "/api/secretaries/invitation/info"], ["Secretaries", "POST", "/api/secretaries/onboard"], ["Secretaries", "GET", "/api/secretaries/userId/{userId}"], ["Secretaries", "GET", "/api/secretaries/doctorUserId/{doctorUserId}"], ["Secretaries", "DELETE", "/api/secretaries/delete/userId/{userId}"],
  ["Secretary Locations", "POST", "/api/secretary-locations/assign"], ["Secretary Locations", "POST", "/api/secretary-locations/remove"], ["Secretary Locations", "GET", "/api/secretary-locations/secretary/userId/{userId}"], ["Secretary Locations", "PUT", "/api/secretary-locations/update"],
  ["Search", "GET", "/api/global-search/search"], ["Search", "POST", "/api/global-search/search"], ["Search", "GET", "/api/global-search/cities/doctors"], ["Search", "GET", "/api/global-search/cities/hospitals"],
  ["Chat", "POST", "/api/chat/threads"], ["Chat", "GET", "/api/chat/threads/id/{threadId}"], ["Chat", "GET", "/api/chat/threads/doctor/{doctorUserId}"], ["Chat", "GET", "/api/chat/threads/patient/{patientUserId}"], ["Chat", "POST", "/api/chat/threads/{threadId}/messages"], ["Chat", "GET", "/api/chat/threads/{threadId}/messages"],
  ["Specialities", "GET", "/api/speciality/all"],
];

const publicOperations = new Set([
  "POST /api/auth/sign-up", "POST /api/auth/hospital/sign-up", "POST /api/auth/sign-in", "POST /api/auth/forgot-password", "POST /api/auth/verify-otp", "POST /api/auth/reset-password", "POST /api/admin/auth/sign-in", "GET /api/admin/speciality/all", "GET /api/admin/speciality/id/{id}", "GET /api/speciality/all",
  "GET /api/doctors/paginated", "GET /api/doctors/id/{userId}", "GET /api/doctors/{doctorId}", "GET /api/doctors/invitation/info", "POST /api/doctors/onboard", "GET /api/doctors/location/all/{doctorId}", "GET /api/doctors/location/{locationId}", "GET /api/doctors/availability/all/doctorId/{doctorId}/status", "GET /api/doctors/availability/all/doctorId/{doctorId}/location/{doctorLocationId}", "GET /api/doctors/availability/time-slots/default", "GET /api/doctors/unavailability/all/doctorId/{doctorId}",
  "GET /api/appointments/available-slots/doctor/{doctorId}/doctor-location/{doctorLocationId}", "GET /api/appointments/type/all", "GET /api/hospitals/public/{id}", "GET /api/global-search/search", "POST /api/global-search/search", "GET /api/global-search/cities/doctors", "GET /api/global-search/cities/hospitals", "GET /api/secretaries/invitation/info", "POST /api/secretaries/onboard",
]);

function requestSchema(path) {
  if (path.endsWith("forgot-password")) return "EmailRequest";
  if (path.endsWith("verify-otp")) return "VerifyOtpRequest";
  if (path.endsWith("reset-password")) return "ResetPasswordRequest";
  if (path.includes("book-appointment")) return "AppointmentInput";
  if (path.includes("cancel-appointment")) return null;
  if (path.includes("availability/")) return path.includes("unavailability") ? "UnavailabilityInput" : "AvailabilityInput";
  if (path.includes("unavailability/")) return "UnavailabilityInput";
  if (path.includes("/doctors/update") || path.endsWith("/doctors/onboard")) return "DoctorInput";
  if (path.includes("/doctors/location/")) return "LocationInput";
  if (path.includes("/hospitals/locations/")) return "LocationInput";
  if (path.includes("/hospitals/create") || path.includes("/hospitals/update")) return "HospitalInput";
  if (path.includes("/hospital-doctors/assign")) return "HospitalDoctorInput";
  if (path.includes("/admin/speciality/")) return "SpecialityInput";
  if (path.includes("/admin/users/")) return "UserInput";
  if (path.includes("/admin/roles/")) return "RoleInput";
  if (path.includes("/patients/beneficiary/")) return "BeneficiaryInput";
  if (path.includes("/patients/update")) return "UserInput";
  if (path.includes("/secretary-locations/")) return "SecretaryLocationInput";
  if (path.includes("/secretaries/") && !path.includes("invite")) return "SecretaryInput";
  if (path.endsWith("/chat/threads")) return "ChatThreadInput";
  if (path.includes("/messages")) return "ChatMessageInput";
  if (path.includes("global-search/search")) return "SearchInput";
  return null;
}

function queryParameters(path) {
  const query = [];
  if (path.includes("paginated")) query.push({ name: "page", in: "query", schema: { type: "integer", minimum: 0, default: 0 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, default: 10 } });
  if (path.includes("/doctors/paginated") || path.includes("/patients/search") || path.includes("/admin/users/paginated")) query.push({ name: "search", in: "query", schema: { type: "string" } });
  if (path.includes("available-slots") || path.includes("/date/doctorLocationId/")) query.push({ name: "date", in: "query", schema: { type: "string", format: "date" } });
  if (path.includes("global-search/search")) query.push({ name: "q", in: "query", schema: { type: "string" } }, { name: "city", in: "query", schema: { type: "string" } });
  return query;
}

for (const [tag, method, path] of routeDocs) {
  swaggerSpec.paths[path] = swaggerSpec.paths[path] || {};
  if (swaggerSpec.paths[path][method.toLowerCase()]) continue;
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({ name, in: "path", required: true, schema: { type: "integer" } })).concat(queryParameters(path));
  const schemaName = requestSchema(path);
  const operation: any = {
    tags: [tag],
    summary: `${method} ${path}`,
    security: publicOperations.has(`${method} ${path}`) ? [] : [{ bearerAuth: [] }],
    responses: {
      [method === "POST" ? 201 : 200]: {
        description: "Success",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } },
      },
      401: { description: "Authentication required" },
      404: { description: "Resource not found" },
    },
  };
  if (parameters.length) operation.parameters = parameters;
  if (["POST", "PUT", "PATCH"].includes(method) && schemaName) {
    const contentType = path.includes("/messages") ? "multipart/form-data" : "application/json";
    operation.requestBody = { required: true, content: { [contentType]: { schema: { $ref: `#/components/schemas/${schemaName}` } } } };
  }
  if (path.includes("cancel-appointment")) {
    operation.requestBody = {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              cancellationReason: { type: "string", example: "Patient requested cancellation" },
            },
          },
        },
      },
    };
  }
  swaggerSpec.paths[path][method.toLowerCase()] = operation;
}

module.exports = swaggerSpec;

