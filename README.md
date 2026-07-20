# AI Knowledge Assistant

FastAPI backend foundation for an enterprise RAG knowledge assistant.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Configure the local `.env` file before starting the application. The API is available at `http://localhost:8000`, with interactive documentation at `/docs` and a health check at `/health`.
