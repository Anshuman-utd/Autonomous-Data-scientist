<div align="center">

# 🤖 Autonomous AI Data Scientist

**An enterprise-grade, AI-powered full-stack platform that automates the complete data science workflow — from raw CSV upload to live ML inference, explainability, and one-click production deployment.**

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-4.2-092E20?style=flat-square&logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C?style=flat-square&logo=langchain&logoColor=white)](https://langchain.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)

</div>

---

## 🎯 What Is This?

Autonomous AI Data Scientist eliminates the need for manual data science scripting. A business analyst, researcher, or product manager can:

1. **Upload** any CSV dataset
2. **Explore** automatic Exploratory Data Analysis (EDA) — distributions, missing values, correlations, outliers
3. **Clean** the dataset intelligently with one click using the Smart Cleaning pipeline
4. **Train** a full ML tournament (6 algorithms competing simultaneously) against a chosen target column
5. **Explain** model decisions via SHAP-inspired feature importance charts
6. **Predict** live outcomes interactively with the "What-If" Simulator — no code required
7. **Export** a professional PDF/HTML executive briefing report for stakeholders
8. **Deploy** the trained model as a production-ready FastAPI REST API with a single download
9. **Chat** with an AI analyst that answers natural-language questions about the dataset

All without writing a single line of code.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTONOMOUS AI DATA SCIENTIST                          │
│                                                                              │
│  ┌─────────────────── FRONTEND (React + Vite) ──────────────────────────┐   │
│  │                                                                        │   │
│  │  ┌──────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │Dashboard │  │  Workspace  │  │ModelTraining │  │   Upload     │  │   │
│  │  │          │  │  (5 Tabs)   │  │              │  │              │  │   │
│  │  └──────────┘  └──────┬──────┘  └──────────────┘  └──────────────┘  │   │
│  │                        │                                               │   │
│  │   Workspace Tabs:   Overview │ Predict │ Explainability │ Deploy       │   │
│  └────────────────────────┼───────────────────────────────────────────────┘   │
│                            │ JWT Auth + Axios                                  │
│                            ▼                                                   │
│  ┌─────────────────── BACKEND (Django REST Framework) ─────────────────────┐  │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │  │
│  │  │                    REST API Endpoints                            │    │  │
│  │  │  /api/upload   /api/eda    /api/train    /api/predict            │    │  │
│  │  │  /api/models   /api/chat  /api/predict  /api/model-schema       │    │  │
│  │  │  /api/export-report       /api/export-deployment                │    │  │
│  │  │  /api/datasets/<id>/transform                                   │    │  │
│  │  └────────────────────────────────────────────────────────────────-┘    │  │
│  │                                                                           │  │
│  │  ┌─────────────┐  ┌────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │ ML Pipeline │  │  AI Agent      │  │  Report & Export Engine      │  │  │
│  │  │             │  │ (LangGraph)    │  │                              │  │  │
│  │  │ preprocess  │  │                │  │  report_generator.py         │  │  │
│  │  │ train       │  │  tools.py      │  │  (HTML/PDF Briefings)        │  │  │
│  │  │ evaluate    │  │  workflow.py   │  │                              │  │  │
│  │  │ save_model  │  │                │  │  FastAPI Deployment ZIP      │  │  │
│  │  └──────┬──────┘  └───────┬────────┘  └──────────────────────────────┘  │  │
│  │         │                 │                                               │  │
│  │         ▼                 ▼                                               │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │  │
│  │  │          Dual-Mode Execution & Caching Layer                     │    │  │
│  │  │                                                                   │    │  │
│  │  │  ┌──────────────────────┐  ┌──────────────────────────────────┐  │    │  │
│  │  │  │  Synchronous Mode    │  │  Async Mode (with Redis)         │  │    │  │
│  │  │  │  (no Redis needed)   │  │                                  │  │    │  │
│  │  │  │  CELERY_ALWAYS_EAGER │  │  Celery Worker + Redis Broker    │  │    │  │
│  │  │  │  = True (auto)       │  │  LocMem → Redis Cache Fallback   │  │    │  │
│  │  │  └──────────────────────┘  └──────────────────────────────────┘  │    │  │
│  │  └─────────────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌────────────────────── PERSISTENCE LAYER ────────────────────────────────┐   │
│  │                                                                           │   │
│  │  ┌──────────────────────────┐   ┌──────────────────────────────────┐    │   │
│  │  │  PostgreSQL / SQLite DB   │   │  Ephemeral File System (Media)   │    │   │
│  │  │                           │   │                                  │    │   │
│  │  │  Dataset.csv_data ◄───── │   │  datasets/ models/               │    │   │
│  │  │  (CSV backup as TEXT)     │   │  (auto-reconstituted on restart) │    │   │
│  │  │                           │   └──────────────────────────────────┘    │   │
│  │  │  ModelRecord.binary_data  │                                            │   │
│  │  │  (Serialized .pkl as BLOB)│   Ephemeral disk files are always          │   │
│  │  │                           │   reconstructed from DB on container       │   │
│  │  │  ChatHistory (Q&A Logs)   │   restart — no cloud storage required.    │   │
│  │  └──────────────────────────┘                                             │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: CSV Upload → Live Prediction

```
User Upload CSV
      │
      ▼
UploadDatasetView ──► EDA Pipeline (pandas statistics)
      │                      │
      │                      ▼
      │              Dataset.metadata ─── Redis Cache (or LocMem)
      │
      ▼
TrainModelView
      │
      ├─► preprocess_data()     → Imputation, LabelEncoding, StandardScaler
      ├─► train_models()        → 6 algorithms in ThreadPoolExecutor
      ├─► evaluate_models()     → Accuracy/R²/F1/RMSE + Feature Importance
      │
      ▼
ModelRecord saved to DB
      ├── metrics (JSON): all_results, feature_importance, schema_info, target_column
      └── binary_data (BLOB): complete inference bundle (model + preprocessors)
              │
              ▼
ModelSchemaView  ─── GET input field specs → PredictionPlayground UI
LivePredictView  ─── POST inputs          → predict_with_bundle() → Result
```

---

## ✨ Feature Overview

### 🔐 Authentication & Security
- JWT-based registration and login via `djangorestframework-simplejwt`
- Custom `QueryParamOrHeaderJWTAuthentication` — supports `Authorization: Bearer` headers **and** `?token=<jwt>` query params (needed for browser popup file downloads)
- Strict per-user data isolation: all DB queries are filtered by `user=request.user`

### 📂 Dataset Management
- Drag-and-drop CSV upload with automatic schema detection
- Dataset stored in two ways: as a file (`media/datasets/`) **and** as raw text in `Dataset.csv_data` (PostgreSQL `TextField`)
- On container restarts (ephemeral cloud hosting), the file is automatically rebuilt from the database copy
- Per-user unique dataset name constraint prevents duplicate uploads

### 📊 Automated EDA (Exploratory Data Analysis)
- **Overview:** row count, column count, numeric vs. categorical breakdown
- **Statistics:** mean, median, standard deviation, min, max per column
- **Missing Values:** per-column counts with visual bar chart
- **Distributions:** histogram charts for numeric columns
- **Categorical Distributions:** frequency bar charts for string columns
- **Correlation Heatmap:** interactive matrix with colour coding
- **Outlier Detection:** IQR-based detection with column-level outlier counts
- Results cached in Redis (if available) or Django's `LocMemCache` for instant re-loads

### 🧹 Smart Data Cleaning
- One-click automated cleaning pipeline
- Numeric missing values → imputed with **column median**
- Categorical missing values → imputed with **most frequent value**
- High-cardinality text columns → **Label Encoded** automatically
- Outliers beyond IQR bounds → **capped at whisker values**
- Updated dataset saved back to the database; EDA refreshed immediately

### 🤖 ML Tournament Pipeline
The platform trains **6 algorithms simultaneously** using `ThreadPoolExecutor` and selects the champion by score:

| Task Type | Algorithms |
|---|---|
| **Classification** | Logistic Regression, Random Forest Classifier, Decision Tree, SVM / Linear SVM, K-Nearest Neighbors, Naive Bayes |
| **Regression** | Linear Regression, Random Forest Regressor, Decision Tree Regressor, SVR / Linear SVR, K-Nearest Neighbors Regressor |

**Evaluation Metrics**
- Classification: Accuracy, F1-Score (weighted), Precision, Recall, Confusion Matrix
- Regression: R² Score, RMSE, MAE

**Model Persistence**
- Saved to `media/models/` as a complete **inference bundle** (`.pkl`) containing: the trained estimator, fitted imputers, label encoders, scaler, feature schema, target classes, and feature importance
- Also persisted as `ModelRecord.binary_data` (binary blob in DB) — models survive container restarts and work without cloud storage

### 📈 Feature Importance & Explainability
- **Tree-based models** (Random Forest, Decision Tree): uses `model.feature_importances_`
- **Linear models** (Logistic/Linear Regression, SVM): uses `abs(model.coef_)`
- **Legacy models** (no precomputed importance): dynamically unpacked from `binary_data` and calculated live
- **Fallback**: normalized correlation-matrix scores from EDA data
- Results shown as animated horizontal bar charts in the `FeatureImportanceChart` component

### 🎮 Interactive "What-If" Predictor (Live Inference)
- Dynamically generates input sliders, number inputs, and dropdown menus from model schema
- **Strict target column isolation**: uses `model.feature_names_in_` as the single source of truth; the target column is never rendered as an input
- Supports classification (prediction + probability distributions + confidence %) and regression (numeric result)
- "Random Scenario" generator for exploring boundary cases
- Inline top-3 feature driver explanation

### 📄 Executive Report Export
- One-click HTML report with `@media print` styling for PDF conversion
- Contains: dataset KPI grid, EDA summary, algorithm tournament leaderboard (sorted by score), feature importance bar chart, strategic recommendations
- Report opens authenticated in a new tab via `?token=<jwt>` query parameter
- Full backward compatibility: supports legacy metric schemas from all historical training runs

### 🚀 One-Click Production Deployment Export
- Downloads a complete ZIP bundle containing:
  - `main.py`: fully working FastAPI REST server with `/predict` endpoint
  - `bundle.joblib`: the serialized model + preprocessors
  - `requirements.txt`: exact dependency pinning
  - `Dockerfile`: containerized deployment image
  - `README.md`: curl usage examples
- Deployable to any cloud service (Railway, Fly.io, Render) in under 5 minutes

### 💬 Conversational AI Analyst
- Powered by **LangChain + LangGraph** agent orchestration
- Context-aware: the agent has access to the active dataset's EDA statistics, column schemas, and correlation matrices
- Supports: schema questions, statistical queries, anomaly descriptions, business interpretation
- LLM backends: **Groq** (Llama3/Mixtral, fast inference) and **OpenAI** (GPT-4o)
- Conversation history persisted per dataset in `ChatHistory` model
- Floating chat UI with code-block formatting and click-to-copy utility

---

## 🛠️ Technology Stack

### Frontend
| Technology | Role |
|---|---|
| **React 18** | UI framework with hooks and component architecture |
| **Vite** | Ultra-fast dev server and build tooling |
| **React Router v6** | Client-side routing |
| **Axios** | HTTP client with interceptors for auth |
| **Recharts** | Composable chart library (area, scatter, radar, line charts) |
| **Lucide React** | Icon library |
| **CSS Variables** | Custom design tokens (dark-mode, glassmorphism) |

### Backend
| Technology | Role |
|---|---|
| **Django 4.2** | Web framework |
| **Django REST Framework** | API layer, serializers, viewsets |
| **SimpleJWT** | JWT token authentication + refresh |
| **django-cors-headers** | CORS for frontend-backend separation |
| **Gunicorn** | WSGI production server |
| **WhiteNoise** | Static file serving without a CDN |

### Machine Learning
| Technology | Role |
|---|---|
| **scikit-learn 1.4** | Model training, evaluation, preprocessing |
| **pandas 2.2** | Data manipulation and EDA computation |
| **NumPy 1.26** | Array operations and statistical utilities |
| **joblib** | Model serialization and parallel computing |

### AI & Agent Layer
| Technology | Role |
|---|---|
| **LangChain 0.3** | LLM chain composition and tool binding |
| **LangGraph 0.6** | Stateful agent graph execution |
| **Groq API** | Fast LLM inference (Llama 3, Mixtral) |
| **OpenAI API** | GPT-4o access for complex queries |
| **langchain-community** | EDA tool integration |

### Infrastructure
| Technology | Role |
|---|---|
| **PostgreSQL 16** | Production relational database |
| **SQLite** | Development database (zero-configuration) |
| **Redis 7** | Celery broker and EDA response cache |
| **Celery 5.3** | Asynchronous task queue for model training |
| **Docker + Compose** | Container orchestration (5-service stack) |
| **dj-database-url** | 12-factor database URL parsing |

---

## 🗂️ Project Structure

```
Autonomous-Data-scientist/
├── backend/
│   ├── api/
│   │   ├── agent/
│   │   │   ├── tools.py           # LangChain tools (EDA queries, statistics)
│   │   │   └── workflow.py        # LangGraph agent graph definition
│   │   ├── ml/
│   │   │   ├── preprocess.py      # Feature engineering, imputation, schema extraction
│   │   │   ├── train.py           # Multi-algorithm training with ThreadPoolExecutor
│   │   │   ├── evaluate.py        # Metrics computation + feature importance
│   │   │   └── save_model.py      # Model serialization and bundle creation
│   │   ├── utils/
│   │   │   ├── eda.py             # EDA statistics computation
│   │   │   ├── file_handler.py    # Ephemeral filesystem recovery helper
│   │   │   └── report_generator.py # HTML executive report template engine
│   │   ├── models.py              # Dataset, ModelRecord, ChatHistory ORM models
│   │   ├── views.py               # All API view classes (18 endpoints)
│   │   ├── urls.py                # URL routing
│   │   ├── auth.py                # Custom JWT authentication class
│   │   ├── serializers.py         # DRF serializer classes
│   │   └── tasks.py               # Celery async training task
│   ├── core/
│   │   ├── settings.py            # Django settings with env-based configuration
│   │   ├── celery.py              # Celery application factory
│   │   └── urls.py                # Root URL configuration
│   ├── Dockerfile                 # Backend container image
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Workspace.jsx      # Main analysis workspace (5-tab layout)
│       │   ├── Dashboard.jsx      # Dataset gallery and project hub
│       │   ├── ModelTraining.jsx  # ML tournament UI
│       │   ├── Upload.jsx         # File upload with drag-and-drop
│       │   └── Auth.jsx           # Login / Registration
│       ├── components/
│       │   ├── PredictionPlayground.jsx   # What-If interactive predictor
│       │   ├── FeatureImportanceChart.jsx # Explainability bar chart
│       │   ├── SmartCleaningSection.jsx   # One-click data cleaning UI
│       │   ├── DeploymentExportTab.jsx    # FastAPI deployment export
│       │   ├── FloatingChat.jsx           # AI analyst chat widget
│       │   ├── CorrelationHeatmap.jsx     # Interactive correlation matrix
│       │   ├── DistributionCharts.jsx     # Numeric distribution histograms
│       │   ├── CategoricalCharts.jsx      # Categorical frequency charts
│       │   ├── MissingValuesChart.jsx     # Missing values bar chart
│       │   ├── OutliersSection.jsx        # Outlier detection results
│       │   ├── ModelComparisonTable.jsx   # Algorithm leaderboard table
│       │   └── ui/                        # Shared design system components
│       └── config/api.js                  # Central API URL configuration
│
├── docker-compose.yml             # 5-service orchestration (DB, Redis, Backend, Worker, Frontend)
└── README.md
```

---

## ⚙️ Environment Configuration

### Backend (create `backend/.env`)
```env
# ── Django Core ────────────────────────────────────────────────────────────
SECRET_KEY=django-insecure-replace-with-a-long-random-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# ── Database ────────────────────────────────────────────────────────────────
# Omit to use SQLite (local dev) — or provide a full PostgreSQL URL
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME

# ── AI / LLM Keys ───────────────────────────────────────────────────────────
GEMINI_API_KEY=your-gemini-api-key-here
GROQ_API_KEY=your-groq-api-key-here
OPENAI_API_KEY=your-openai-api-key-here

# ── Redis & Celery (OPTIONAL) ───────────────────────────────────────────────
# If omitted, tasks run synchronously and in-memory cache is used automatically.
# REDIS_URL=redis://127.0.0.1:6379/0
# USE_REDIS_CACHE=False
# CELERY_ALWAYS_EAGER=True
```

### Frontend (create `frontend/.env`)
```env
VITE_API_URL=http://localhost:8000
```

---

## 🚀 Quick Start: Local Development

> **Prerequisites:** Python 3.11+, Node.js 18+, Git

### 1. Clone the Repository
```bash
git clone https://github.com/Anshuman-utd/Autonomous-Data-scientist.git
cd Autonomous-Data-scientist
```

### 2. Set Up the Backend
```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # macOS/Linux
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Copy the example environment file and fill in your API keys
cp .env.example .env

# Run database migrations
python manage.py migrate

# Verify the system configuration
python manage.py check

# Start the development server (runs on port 8000)
python manage.py runserver
```

### 3. Set Up the Frontend
```bash
# Open a new terminal
cd frontend
npm install
npm run dev       # Starts Vite dev server on http://localhost:5173
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🐳 Docker Deployment (Full Stack)

Run the entire platform in one command. This spins up 5 containers: PostgreSQL, Redis, Django API, Celery Worker, and React/Nginx frontend.

```bash
# Build and start all services
docker compose up --build

# Run in background
docker compose up --build -d

# Apply migrations
docker compose exec backend python manage.py migrate
```

| Service | URL |
|---|---|
| React Frontend | http://localhost:3000 |
| Django API | http://localhost:8000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## ☁️ Cloud Deployment

### Backend → Render (Web Service)

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT` |

**Environment Variables:**
```
SECRET_KEY        = <your_random_secret>
DEBUG             = False
ALLOWED_HOSTS     = *
DATABASE_URL      = <your_neon_or_render_postgres_url>
GROQ_API_KEY      = <your_key>
OPENAI_API_KEY    = <your_key>
CELERY_ALWAYS_EAGER = True    # No Redis needed on free tier
```

> **Note:** `Dataset.csv_data` and `ModelRecord.binary_data` in PostgreSQL act as a persistent backup — all datasets and models survive container restarts. Redis is not required.

### Frontend → Vercel

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | `Vite` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**Environment Variable:**
```
VITE_API_URL = https://your-render-backend-url.onrender.com
```

---

## 📋 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Register a new user account |
| `POST` | `/api/login` | Authenticate and receive JWT tokens |
| `POST` | `/api/token/refresh` | Refresh an expired access token |

### Dataset Operations
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload and auto-analyze a CSV dataset |
| `GET` | `/api/datasets` | List all datasets for the authenticated user |
| `GET` | `/api/datasets/<id>` | Get dataset metadata and preview |
| `POST` | `/api/datasets/<id>/transform` | Apply smart cleaning pipeline |
| `GET` | `/api/eda?dataset_id=<id>` | Get full EDA analysis report |
| `GET` | `/api/download-dataset?dataset_id=<id>` | Download the cleaned CSV file |

### Model Training & Inference
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/train` | Launch ML tournament for a target column |
| `GET` | `/api/models?dataset_id=<id>` | List trained models for a dataset |
| `GET` | `/api/model-schema?model_id=<id>` | Get input schema for What-If predictor |
| `POST` | `/api/predict` | Run live inference with the What-If predictor |
| `GET` | `/api/download-model?model_id=<id>` | Download the serialized model bundle |
| `GET` | `/api/export-deployment?model_id=<id>` | Download production FastAPI deployment ZIP |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/export-report?dataset_id=<id>&model_id=<id>` | Generate printable HTML executive report |

### Conversational AI
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a natural-language question to the AI analyst |
| `GET` | `/api/chat?dataset_id=<id>` | Retrieve chat message history for a dataset |

---

## 🔑 Key Engineering Decisions

| Design Choice | Rationale |
|---|---|
| **Dual-storage for CSV and models** | `Dataset.csv_data` (TEXT) and `ModelRecord.binary_data` (BLOB) enable serverless/ephemeral container hosting without requiring S3 or cloud object storage. Files are rebuilt on-demand from the database. |
| **`model.feature_names_in_` as ground truth** | Sklearn's fitted feature names are the authoritative reference for input validation, preventing target column leakage in the What-If predictor regardless of what metadata was recorded. |
| **Backward-compatible leaderboard resolution** | 3-tier fallback (`all_results` key → flat algorithm dict → cross-referenced sibling records) ensures historical model runs display correctly without data migration. |
| **`CELERY_TASK_ALWAYS_EAGER` auto-detection** | When `REDIS_URL` is absent, tasks run synchronously. No crashes, no configuration overhead on free hosting tiers. |
| **`QueryParamOrHeaderJWTAuthentication`** | Browser-initiated file downloads (via `window.open`) cannot set `Authorization` headers; the `?token=` query param fallback enables authenticated report and model downloads. |
| **ThreadPoolExecutor for model training** | Trains all 6 algorithms concurrently within the HTTP worker, bounded at `max_workers=3` to avoid CPU contention on free-tier single-core containers. |
| **`@media print` executive reports** | HTML reports render as premium dark-mode interfaces in the browser and automatically switch to a clean white print layout for PDF generation. |

---

## 🤝 Authors

**Anshuman Mehta**  
GitHub: [@Anshuman-utd](https://github.com/Anshuman-utd)

**Shourya Pratap**  
GitHub: [@shouryapratap132006](https://github.com/shouryapratap132006)

---

<div align="center">

**Built with ❤️ — Autonomous AI Data Scientist**

*Upload CSV → Explore → Clean → Train → Explain → Predict → Deploy*

</div>
