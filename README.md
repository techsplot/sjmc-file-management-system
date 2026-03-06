# Solomon Jayden Medical Center (SJMC) File System

This project is a full-stack web application designed as a file registration and management system for the Solomon Jayden Medical Center. It allows administrative staff to manage personal, family, referral, and emergency patient files through a secure and intuitive interface.

## Features

- **Secure Authentication**: Login system for authorized admin access.
- **Dashboard Overview**: At-a-glance statistics for all file types, including total counts and weekly new registrations.
- **Full CRUD Functionality**: Create, Read, Update, and Delete operations for all file types:
    - Personal Files
    - Family Files
    - Referral Files
    - Emergency Files
- **Dynamic Data Tables**: Search and filter capabilities for easy navigation and file retrieval.
- **Responsive UI**: Clean, modern interface built with React and Tailwind CSS.
- **RESTful Backend**: A robust backend powered by Node.js, Express, and MySQL for data persistence.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: MySQL 2
- **Development**: Concurrently (for running frontend and backend together)

---

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- **Node.js**: Version 18.x or later.
- **npm**: (Comes with Node.js).
- **MySQL Server**: A running instance of MySQL (e.g., via Docker, XAMPP, or a direct installation).

---

## Project Setup

Follow these steps to get your development environment set up and running.

### 1. Clone the Repository

First, clone the project repository to your local machine.

```bash
git clone <your-repository-url>
cd <repository-folder>
```

### 2. Backend Setup

The backend server connects to the MySQL database and provides the API for the frontend.

**a. Install Dependencies:**

```bash
cd backend
npm install
```

**b. Configure Environment Variables:**

Create a `.env` file inside the `backend` directory. You can copy the example file to get started:

```bash
cp .env.example .env
```

Now, open the `.env` file and update the values with your MySQL database connection details:

```
# .env file
DB_HOST=127.0.0.1
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=sjmc
PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@sjmc.com
ADMIN_PASSWORD=password123
```

**c. Set Up the Database:**

- Make sure your MySQL server is running.
- Connect to your MySQL server using your preferred client (e.g., MySQL Workbench, DBeaver, or the command line).
- Create the database specified in your `.env` file (e.g., `sjmc`).
- Execute the SQL script provided in the comments of `backend/db.ts` to create all the necessary tables and seed them with initial data.

### 3. Frontend Setup

The frontend is a React single-page application.

**a. Install Dependencies:**

Navigate to the project's root directory and install the necessary npm packages.

```bash
# From the root directory of the project
npm install
```

**b. Configure Frontend Environment (Optional):**

Create a root `.env` (or `.env.local`) from `.env.example` if you want custom API URL and login form prefill values.

```bash
cp .env.example .env.local
```

Available frontend env variables:

- `VITE_API_BASE_URL` (required for production frontend deployments)
- `VITE_LOGIN_EMAIL` (optional prefill)
- `VITE_LOGIN_PASSWORD` (optional prefill, local development only)

---

## Running the Application

This project is configured to run both the frontend and backend servers concurrently with a single command.

From the **root directory** of the project, run:

```bash
npm run dev
```

This command will:
1.  Start the backend API server on `http://localhost:3001`.
2.  Start the frontend Vite development server on `http://localhost:5173` (or another available port).
3.  Automatically open the application in your default web browser.

You can now access the application and test its features.

### Login Credentials

Login credentials are read from backend environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

These variables are required by the backend. Set them in `backend/.env` before running or deploying.

---

## Reliability Notes

- Backend health endpoint: `GET /healthz`
- Backend + DB readiness endpoint: `GET /api/health`
- Frontend API URL can be configured with `VITE_API_BASE_URL` (falls back to `http://localhost:3001` in local dev).

For a cost-free and reliable production setup, use the runbook in [DEPLOY_FREE.md](DEPLOY_FREE.md).
