# Traqo Database Design (MVP)

## 1. Overview

Traqo requires a database to store users, workout plans, exercises, workout sessions, and workout performance data.

The MVP allows users to:

* Create an account quickly
* Create workout plans
* Create personal exercises
* Add exercises to workout plans
* Track sets, reps, weights, and notes
* View workout history

---

# 2. Main Database Entities

The MVP contains these entities:

```
User

Workout Plan

Exercise

Workout Exercise

Workout Session

Workout Set
```

---

# 3. Entity Design

## 3.1 User

Stores user account information.

A user creates an account using their name and password.

The system automatically generates a unique username.

Example:

```
Display Name:
Aryan

Generated Username:
aryan_8392
```

### Table: users

| Column        | Type           | Description               |
| ------------- | -------------- | ------------------------- |
| id            | UUID / Integer | Primary key               |
| username      | String         | Unique generated username |
| display_name  | String         | User's visible name       |
| password_hash | String         | Encrypted password        |
| created_at    | Timestamp      | Account creation date     |
| updated_at    | Timestamp      | Last update date          |

Relationship:

```
One User can have many Workout Plans

One User can have many Workout Sessions

One User can create many Exercises
```

---

# 3.2 Workout Plan

A workout template created by the user.

Example:

```
Push Day

- Bench Press
- Shoulder Press
- Tricep Pushdown
```

### Table: workout_plans

| Column     | Type           | Description           |
| ---------- | -------------- | --------------------- |
| id         | UUID / Integer | Primary key           |
| user_id    | Foreign Key    | Owner of workout plan |
| name       | String         | Workout plan name     |
| created_at | Timestamp      | Creation date         |
| updated_at | Timestamp      | Last update date      |

Relationship:

```
One User has many Workout Plans
```

---

# 3.3 Exercise

Stores exercises created by the user.

Example:

```
Bench Press

Squat

Bicep Curl
```

### Table: exercises

| Column     | Type           | Description    |
| ---------- | -------------- | -------------- |
| id         | UUID / Integer | Primary key    |
| user_id    | Foreign Key    | Exercise owner |
| name       | String         | Exercise name  |
| created_at | Timestamp      | Creation date  |

Relationship:

```
One User can create many Exercises
```

---

# 3.4 Workout Exercise

Connects exercises with workout plans.

This defines which exercises belong to a workout plan and their order.

Example:

```
Workout Plan:
Push Day

1. Bench Press
2. Shoulder Press
3. Tricep Pushdown
```

### Table: workout_exercises

| Column          | Type           | Description          |
| --------------- | -------------- | -------------------- |
| id              | UUID / Integer | Primary key          |
| workout_plan_id | Foreign Key    | Related workout plan |
| exercise_id     | Foreign Key    | Related exercise     |
| order_number    | Integer        | Exercise sequence    |

Relationship:

```
One Workout Plan has many Workout Exercises

One Exercise can belong to many Workout Plans
```

---

# 3.5 Workout Session

Represents an actual workout performed by the user.

Example:

```
January 10

Push Day

Completed
```

### Table: workout_sessions

| Column          | Type           | Description                |
| --------------- | -------------- | -------------------------- |
| id              | UUID / Integer | Primary key                |
| user_id         | Foreign Key    | User who performed workout |
| workout_plan_id | Foreign Key    | Workout performed          |
| started_at      | Timestamp      | Start time                 |
| completed_at    | Timestamp      | Completion time            |

Relationship:

```
One User can have many Workout Sessions
```

---

# 3.6 Workout Set

Stores actual performance data.

Each row represents one completed set.

Example:

```
Bench Press

Set 1:
80kg × 10 reps

Set 2:
80kg × 8 reps
```

### Table: workout_sets

| Column             | Type           | Description             |
| ------------------ | -------------- | ----------------------- |
| id                 | UUID / Integer | Primary key             |
| workout_session_id | Foreign Key    | Related workout session |
| exercise_id        | Foreign Key    | Exercise performed      |
| set_number         | Integer        | Set order               |
| weight             | Decimal        | Weight used             |
| reps               | Integer        | Number of repetitions   |
| notes              | Text           | Optional notes          |

Relationship:

```
One Workout Session has many Workout Sets
```

---

# 4. Database Relationship Overview

```
                 User
                  |
        -----------------------
        |          |          |
        ↓          ↓          ↓

 Workout Plan  Exercise  Workout Session
        |                    |
        |                    |
        ↓                    ↓

Workout Exercise        Workout Set
        |
        |
        ↓

   Exercise
```

---

# 5. Future Improvements (V2+)

Future versions may add:

* Email authentication
* Password recovery
* Google login
* Phone authentication
* Global exercise library
* Exercise categories
* Muscle groups
* Exercise videos
* Personal records table
* Trainer accounts
* Nutrition tracking

```
```
