# Traqo API Documentation (MVP)

## 1. Overview

Traqo uses a REST API architecture for communication between the frontend and backend.

The frontend communicates with the Flask backend through HTTP requests. The backend handles business logic and communicates with PostgreSQL for data storage.

## Architecture Flow

```
Frontend (React)
        |
        |
     REST API
        |
        |
Backend (Flask)
        |
        |
Database (PostgreSQL)
```

---

# 2. API Conventions

## Base URL

Development:

```
http://localhost:5000/api
```

---

## Authentication

Traqo uses JWT-based authentication.

After successful login, the server returns a token.

The frontend sends this token with protected requests.

Example:

```
Authorization: Bearer <token>
```

---

## HTTP Methods

| Method | Purpose              |
| ------ | -------------------- |
| GET    | Retrieve data        |
| POST   | Create new data      |
| PUT    | Update existing data |
| DELETE | Remove data          |

---

# 3. Authentication API

---

# 3.1 Register User

Creates a new Traqo account.

## Endpoint

```
POST /auth/register
```

## Request Body

```json
{
  "display_name": "Aryan",
  "password": "password123"
}
```

## Backend Process

1. Validate input
2. Generate unique username
3. Hash password
4. Create user record
5. Return account information

## Response

```json
{
  "message": "Account created successfully",
  "username": "aryan_8392"
}
```

---

# 3.2 Login User

Authenticates an existing user.

## Endpoint

```
POST /auth/login
```

## Request Body

```json
{
  "username": "aryan_8392",
  "password": "password123"
}
```

## Response

```json
{
  "token": "jwt_token_here",
  "user": {
    "username": "aryan_8392",
    "display_name": "Aryan"
  }
}
```

---

# 4. Workout Plan API

Workout plans are templates created by users.

Example:

```
Push Day

- Bench Press
- Shoulder Press
- Tricep Pushdown
```

---

# 4.1 Create Workout Plan

Creates a new workout plan.

## Endpoint

```
POST /workout-plans
```

## Authentication

Required

## Request Body

```json
{
  "name": "Push Day"
}
```

## Response

```json
{
  "id": 1,
  "name": "Push Day"
}
```

---

# 4.2 Get Workout Plans

Returns all workout plans belonging to the logged-in user.

## Endpoint

```
GET /workout-plans
```

## Response

```json
[
  {
    "id": 1,
    "name": "Push Day"
  },
  {
    "id": 2,
    "name": "Leg Day"
  }
]
```

---

# 4.3 Update Workout Plan

Updates an existing workout plan.

## Endpoint

```
PUT /workout-plans/{id}
```

Example:

```
PUT /workout-plans/1
```

## Request Body

```json
{
  "name": "Upper Body Day"
}
```

---

# 4.4 Delete Workout Plan

Deletes a workout plan.

## Endpoint

```
DELETE /workout-plans/{id}
```

---

# 5. Exercise API

Exercises are created by users and added to workout plans.

---

# 5.1 Create Exercise

Creates a new exercise.

## Endpoint

```
POST /exercises
```

## Request Body

```json
{
  "name": "Bench Press"
}
```

## Response

```json
{
  "id": 1,
  "name": "Bench Press"
}
```

---

# 5.2 Get Exercises

Returns all exercises created by the user.

## Endpoint

```
GET /exercises
```

## Response

```json
[
  {
    "id":1,
    "name":"Bench Press"
  },
  {
    "id":2,
    "name":"Squat"
  }
]
```

---

# 6. Workout Plan Exercise API

Connects exercises with workout plans.

Relationship:

```
Workout Plan

      |

Workout Exercise

      |

Exercise
```

---

# 6.1 Add Exercise To Workout Plan

Adds an exercise to a workout plan.

## Endpoint

```
POST /workout-plans/{id}/exercises
```

Example:

```
POST /workout-plans/1/exercises
```

## Request Body

```json
{
  "exercise_id": 5
}
```

## Response

```json
{
  "message": "Exercise added successfully"
}
```

---

# 7. Workout Session API

A workout session represents an actual completed workout.

Example:

```
Push Day
10 July 2026
45 minutes
```

---

# 7.1 Start Workout

Creates a new workout session.

## Endpoint

```
POST /workout-sessions
```

## Request Body

```json
{
  "workout_plan_id": 1
}
```

## Response

```json
{
  "session_id": 20,
  "message": "Workout started"
}
```

---

# 7.2 Add Workout Set

Records a completed exercise set.

Each row represents one set.

Example:

```
Bench Press

Set 1
80kg
10 reps
```

## Endpoint

```
POST /workout-sessions/{id}/sets
```

## Request Body

```json
{
  "exercise_id": 5,
  "weight": 80,
  "reps": 10,
  "notes": "Felt strong"
}
```

## Response

```json
{
  "message": "Set recorded"
}
```

---

# 7.3 Finish Workout

Completes a workout session.

## Endpoint

```
PUT /workout-sessions/{id}/finish
```

## Response

```json
{
  "message": "Workout completed"
}
```

---

# 8. Workout History API

Returns previous workout sessions.

---

# 8.1 Get Workout History

## Endpoint

```
GET /workout-history
```

## Response

```json
[
  {
    "date":"2026-07-10",
    "workout":"Push Day",
    "duration":"45 minutes"
  }
]
```

---

# 9. Error Response Format

All errors follow this structure:

```json
{
  "error": "Invalid username or password"
}
```

Common HTTP status codes:

| Code | Meaning            |
| ---- | ------------------ |
| 200  | Successful request |
| 201  | Resource created   |
| 400  | Bad request        |
| 401  | Unauthorized       |
| 404  | Not found          |
| 500  | Server error       |

---

# 10. Future API Improvements

Future versions may include:

* Email authentication
* Password reset API
* Google OAuth
* Personal records API
* Exercise library API
* Progress analytics API
* Trainer API
* Nutrition API

```
```
