# 🚀 Autonomous Data Scientist

An AI-powered full-stack web application that automates the complete data science workflow — from dataset upload to model training, evaluation, and interactive insights using agentic AI.

---

## 🧠 Overview

**Autonomous Data Scientist** simulates the role of a data scientist by enabling users to:

- Upload datasets (CSV)
- Perform Exploratory Data Analysis (EDA)
- Train Machine Learning models
- Evaluate and download trained models
- Interact with datasets using AI-powered chat
- Manage datasets and models securely with authentication

---

## ✨ Features

### 🔐 Authentication
- User registration & login  
- JWT-based authentication  
- User-specific data isolation  

### 📂 Dataset Management
- Upload CSV datasets  
- Automatic schema detection  
- Data preview & metadata storage  
- Resume previously uploaded datasets  

### 📊 Exploratory Data Analysis (EDA)
- Column insights and summaries  
- Data previews  
- Statistical analysis  
- Automated insights  

### 🤖 Machine Learning Pipeline
- Automatic preprocessing  
- Model training (classification/regression)  
- Model evaluation and comparison  
- Best model selection  
- Download trained models (.pkl)  

### 💬 AI Chat (Agentic AI)
- Ask questions about your dataset  
- Context-aware responses  
- Maintains chat history  
- Powered by LLM + LangChain + LangGraph  

### 💾 Data Persistence
- User-specific datasets and models  
- Stored in PostgreSQL database  

---

## 🛠️ Tech Stack

Frontend:
- React (Vite)
- Tailwind CSS

Backend:
- Django
- Django REST Framework
- JWT Authentication

AI / ML:
- Scikit-learn
- Pandas, NumPy
- LangChain
- LangGraph
- OpenAI / Groq APIs

Database:
- PostgreSQL (Neon / Prisma)

Deployment:
- Frontend: Vercel  
- Backend: Render  

---

## ⚙️ Environment Variables

Create `.env` files for backend and frontend:

Backend `.env`:
```env
DEBUG=False
SECRET_KEY=your_secret_key
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
GROQ_API_KEY=your_api_key
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```

Frontend `.env`:
```env
VITE_API_URL=https://your-backend.onrender.com
```

---

## 🚀 Installation & Setup

```bash
# Clone repository
git clone https://github.com/your-username/Autonomous-Data-scientist.git
cd Autonomous-Data-scientist

# Backend setup
cd backend
python -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start backend server
python manage.py runserver

# Frontend setup (open new terminal)
cd frontend
npm install
npm run dev
```

---

## 🌐 Deployment

```bash
# Backend (Render)
gunicorn core.wsgi:application --bind 0.0.0.0:$PORT

# Frontend (Vercel)
# Set environment variable:
VITE_API_URL=https://your-backend-url
```

---

## 📡 API Endpoints

Authentication:
- POST /api/register
- POST /api/login

Dataset:
- POST /api/upload
- GET /api/datasets

EDA:
- GET /api/eda?dataset_id=<id>

Model:
- POST /api/train
- GET /api/models
- GET /api/download-model?model_id=<id>

Chat:
- POST /api/chat
- GET /api/chat?dataset_id=<id>

---

## 🔥 Key Highlights

- Full-stack AI + ML application  
- Implements Agentic AI workflows  
- Real-world deployment architecture  
- Scalable backend design  
- Database + file storage integration  
- Interactive AI-powered analytics  

---

## ⚠️ Challenges & Learnings

- Handling ML workloads in production  
- Optimizing backend startup (lazy loading)  
- Managing CORS and API communication  
- Deploying ML apps on cloud platforms  
- Secure environment variable management  

---

## 🚀 Future Improvements

- Background job processing (Celery / queues)  
- Cloud storage integration (AWS S3)  
- Model versioning  
- Real-time dashboards  
- Multi-user collaboration  

---

## 👨‍💻 Author

**Anshuman Mehta**

GitHub: https://github.com/Anshuman-utd  
LinkedIn: (Add your profile)

---

## ⭐ Support

If you like this project, consider giving it a star ⭐