from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine, Base, SessionLocal
from app.db.migrations import run_startup_migrations, seed_lookup_tables
from app.models import user, voucher, document, disposal, sla_config, notification, asset, asset_voucher, department, station
from app.api.routes import users, auth, vouchers, reports, documents, disposal as disposal_routes, chatbot, assets, asset_vouchers
from app.api.routes.lookups import departments_router, stations_router
from app.core.config import settings
from fastapi import Response

# STEP 1: Create FastAPI app FIRST
app = FastAPI(
    title="ICT Tools ASM Backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# STEP 2: Create database tables
run_startup_migrations(engine)
Base.metadata.create_all(bind=engine)

seed_session = SessionLocal()
try:
    seed_lookup_tables(seed_session)
finally:
    seed_session.close()

# STEP 3: Include routers AFTER app is created
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(vouchers.router, prefix="/vouchers", tags=["Vouchers"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(disposal_routes.router, prefix="/disposal", tags=["Disposal"])
app.include_router(chatbot.router, prefix="/chatbot", tags=["Chatbot"])
app.include_router(assets.router, prefix="/assets", tags=["Assets"])
app.include_router(asset_vouchers.router, prefix="/asset-vouchers", tags=["Asset Vouchers"])
app.include_router(departments_router, prefix="/departments", tags=["Departments"])
app.include_router(stations_router, prefix="/stations", tags=["Stations"])

# STEP 4: Test route
@app.get("/")
def root():
    return {"message": "Backend is running successfully"}

@app.head("/")
def head_root():
    return Response(status_code=200)