from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from deps import get_db
from models import User
from schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if "@" not in payload.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Format email tidak valid.")
    if len(payload.password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password minimal 6 karakter.")

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email sudah terdaftar.")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, name=user.name, email=user.email)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    # Pesan generik disengaja - tidak membedakan "email tidak terdaftar" vs
    # "password salah" (praktik keamanan standar).
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email atau password salah.")

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserOut(id=user.id, name=user.name, email=user.email),
    )
