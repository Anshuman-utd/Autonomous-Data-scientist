# Autonomous Data Scientist

An AI-powered full-stack web application that automates the complete data science workflow, including dataset upload, exploratory data analysis, machine learning model training, evaluation, and interactive conversational insights using agentic AI.

---

## Overview

Autonomous Data Scientist simulates the capabilities of a junior data scientist. The application automates technical workflows to enable users to:

* Upload and validate datasets (CSV format)
* Perform automated Exploratory Data Analysis (EDA) with statistical insights
* Execute machine learning model training pipelines for classification and regression tasks
* Evaluate model metrics and download serialized models (pickle format)
* Query datasets and retrieve correlation summaries through a conversational AI assistant
* Securely manage workspace resources with token-based authentication

---

## Features

### Authentication and Access Control
* Token-based user authentication (JSON Web Tokens)
* Secure registration and login workflows
* Strict user-specific data isolation to protect workspace integrity

### Dataset Management
* CSV dataset ingestion and validation
* Automatic schema detection and data preview parsing
* Persistent storage of dataset records and calculations
* Workspace recovery for previously uploaded files

### Automated Exploratory Data Analysis (EDA)
* Column-level summary statistics and null-value checking
* Distribution calculations for numerical and categorical variables
* Correlation matrices and multi-variable comparison tables
* Automated outlier detection and visualization maps

### Machine Learning Pipeline
* Automatic preprocessing (imputation of missing values, vector scaling)
* Automated split for training and testing subsets
* Multi-model training and evaluation (Random Forest, LightGBM, Logistic Regression)
* Leaderboard comparison based on evaluation scores (Accuracy, R2 score, RMSE)
* Serialization and direct download of the best performing model (.pkl)

### Conversational AI Analyst
* Context-aware conversational assistant trained to query active dataset metrics
* Ability to request schemas, summary statistics, or correlation details
* Structured code-block output formatting with click-to-copy utility
* Pipeline integration powered by LangChain and LangGraph workflows

### Persistence
* Persistent relational database engine storing user metadata and dataset configurations
* Multi-layered storage for datasets and trained model files

---

## Tech Stack

### Frontend
* React (Vite environment)
* Tailwind CSS for interface styling
* Recharts for reactive visualization rendering

### Backend
* Django
* Django REST Framework (DRF)
* SimpleJWT for token authentication management

### Machine Learning and AI
* Scikit-learn for model training and evaluation
* Pandas and NumPy for vector analytics
* LangChain / LangGraph for agent orchestration
* Integration with enterprise LLM provider APIs (Groq, OpenAI)

### Database
* PostgreSQL (Production database engine)
* SQLite (Development/local testing database engine)

---

## Environment Configuration

Configure environment variables in the respective application root folders.

### Backend Configurations
Create a `.env` file inside the `backend/` directory:
```env
DEBUG=False
SECRET_KEY=your_production_secret_key
DATABASE_URL=postgresql://user:password@host:port/dbname
GROQ_API_KEY=your_api_key
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```

### Frontend Configurations
Create a `.env` file inside the `frontend/` directory:
```env
VITE_API_URL=https://your-backend-url.com
```

---

## Installation and Setup

Ensure you have Python 3.9+ and Node.js 18+ installed on your system.

### 1. Backend Service Setup
```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install system dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Run system checks
python manage.py check

# Start development server
python manage.py runserver
```

### 2. Frontend Application Setup
```bash
# Open a new terminal session and navigate to the frontend directory
cd frontend

# Install packages
npm install

# Run Vite dev server
npm run dev
```
The application will launch on `http://localhost:5173`.

---

## Deployment Architecture

### Backend Deployment (e.g., Render, Heroku)
Run migrations and launch the WSGI wrapper using Gunicorn:
```bash
python manage.py migrate
gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
```

### Frontend Deployment (e.g., Vercel, Netlify)
Ensure the environment variable is configured during the build stage:
* Key: `VITE_API_URL`
* Value: Path to your hosted backend API URL

---

## API Endpoints Reference

### Authentication
* `POST /api/register` - Create a new user account
* `POST /api/login` - Authenticate credentials and retrieve JWT tokens

### Dataset Operations
* `POST /api/upload` - Upload and analyze a new CSV dataset
* `GET /api/datasets` - Retrieve all datasets belonging to the active user

### Analytical Reporting
* `GET /api/eda?dataset_id=<id>` - Retrieve exploratory data analysis report

### Model Training
* `POST /api/train` - Initiate autonomous ML pipeline for a target column
* `GET /api/models` - List trained models for a specific dataset
* `GET /api/download-model?model_id=<id>` - Download serialized model pickle

### Interactive Chat Agent
* `POST /api/chat` - Send a question to the conversational dataset analyst
* `GET /api/chat?dataset_id=<id>` - Retrieve chat message history

---

## Architectural Highlights

* **User Data Separation**: Resource access queries are strictly checked against the authenticated request user model.
* **Component-Level Styling**: Layout designs are standardized using reusable sub-components to align structural widths, borders, and margins.
* **Robust File Streaming**: Model serialization downloads stream files directly via an authorized Axios binary blob request to preserve token authorization headers.
* **Isolated Scroll Containers**: Scroll interactions on specialized workspaces use local element references to avoid shifting global layout boundaries or polluting window viewport scrolls.

---

## Author

Anshuman Mehta  
GitHub: [Anshuman-utd](https://github.com/Anshuman-utd)
