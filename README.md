# EduSphere Backend API

A Node.js + Express + PostgreSQL REST API for the EduSphere School Information System.

---

## 📋 API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/change-password | Change password |
| GET | /api/students | List students (search, filter, paginate) |
| GET | /api/students/:id | Get single student |
| POST | /api/students | Create student |
| PUT | /api/students/:id | Update student |
| DELETE | /api/students/:id | Delete student |
| GET | /api/students/:id/results | Student's results |
| GET | /api/students/:id/attendance | Student's attendance |
| GET | /api/results | List all results |
| POST | /api/results | Add/update result |
| PUT | /api/results/:id | Update result |
| GET | /api/attendance | List attendance |
| GET | /api/attendance/summary | Today's summary |
| POST | /api/attendance | Mark single attendance |
| POST | /api/attendance/bulk | Mark class attendance |
| GET | /api/attendance/report | Attendance report |
| GET | /api/billing/invoices | List invoices |
| POST | /api/billing/invoices | Create invoice |
| POST | /api/billing/payments | Record payment |
| GET | /api/billing/summary | Billing summary |
| GET | /api/dashboard/stats | Dashboard statistics |

---

## 🔑 Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Teacher | teacher1 | password123 |
| Accountant | accountant1 | password123 |
| Registrar | registrar1 | password123 |

---

## 🔐 Authentication

All endpoints except `/api/auth/login` require a Bearer token:

```
Authorization: Bearer <your_token_here>
```
