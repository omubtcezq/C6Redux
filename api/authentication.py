"""

"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import select
from pydantic import BaseModel
import jwt
from jwt.exceptions import InvalidTokenError
import bcrypt
from datetime import datetime, timedelta, timezone
import configparser as cp
import api.db as db

# Read config for json web token parameters (key from: "openssl rand -hex 32")
def read_jwt_config():
    config = cp.ConfigParser()
    config.read("api/api.ini")
    db = config["JWT"]
    key = db["key"]
    alg = db["algorithm"]
    token_exp = int(db["token_expiration_minutes"])
    return key, alg, token_exp

# Store jwt parameters in global variables for use in oauth2 tokens
jwt_secret_key, jwt_algorithm, jwt_token_expiration_minutes = read_jwt_config()

# FastAPI authentication creation. Url starting with '/' makes it not relative
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# Token meeting OAuth2 spec
class Token(BaseModel):
    access_token: str
    token_type: str

# Hash a password using bcrypt (helper function)
def hash_password(password):
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password

# Check if the provided password matches the stored password (hashed)
def verify_password(plain_password, hashed_password):
    password_byte_enc = plain_password.encode("utf-8")
    return bcrypt.checkpw(password = password_byte_enc , hashed_password = hashed_password)

# Check that login credentials produce an api user with admin permissions
def authenticate_api_user(session: db.Session, username: str, password: str):
    stmnt = select(db.ApiUser).where(db.ApiUser.username == username, db.ApiUser.admin == 1)
    user = session.exec(stmnt).first()
    if not user:
        return None
    elif not verify_password(password, user.password_hash.encode("utf-8")):
        return None
    else:
        return user

# Used for admin operations, user is gotten from valid token
async def get_authorised_user(jwt_token: str=Depends(oauth2_scheme), session: db.Session=Depends(db.get_readonly_session)):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                          detail="Could not validate token",
                                          headers={"WWW-Authenticate": "Bearer"})
    # Read token
    try:
        access_token = jwt.decode(jwt_token, jwt_secret_key, algorithms=[jwt_algorithm])
        username: str = access_token.get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    # Check db for user and permission
    stmnt = select(db.ApiUser).where(db.ApiUser.username == username)
    user = session.exec(stmnt).first()
    if user is None or not user.admin:
        raise credentials_exception
    # return user
    return user

# ============================================================================ #
# API operations
# ============================================================================ #

router = APIRouter(
    prefix="/auth",
    tags=["Authentication Operations"]
)

@router.post("/token", 
             summary="Gets an authentication token from OAuth2 password request form",
             response_description="OAuth2 authentication token",
             response_model=Token)
async def get_token(login_form: OAuth2PasswordRequestForm=Depends(), session: db.Session=Depends(db.get_readonly_session)):
    # Check if login is correct
    user = authenticate_api_user(session, login_form.username, login_form.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})
    # Token expiration
    expiration = datetime.now(timezone.utc) + timedelta(minutes=jwt_token_expiration_minutes)
    # Token encoding
    encoded_token_data = jwt.encode({"sub": user.username, "exp": expiration}, 
                             jwt_secret_key, 
                             algorithm=jwt_algorithm)
    # Create token json to spec
    return Token(access_token=encoded_token_data, token_type="bearer")

