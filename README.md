# Enterprise RAG + AI Knowledge Assistant

FastAPI backend scaffold for an enterprise retrieval-augmented generation and knowledge assistant platform.

## Local development

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
docker compose up --build
```

The API runs at `http://localhost:8000`, interactive docs at `/docs`, and health at `/health`.

To run the API on the host, change the service hosts in `.env` to `localhost`, then run `uvicorn app.main:app --reload`.
