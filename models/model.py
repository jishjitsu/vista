import os
import io
import uuid
import time
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

app = FastAPI(title="VisionNav Backen")
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables.")
genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="VisionNav Backen")

# Session and media storage
user_sessions = {}  # session_id -> chat object
user_media = {}     # session_id -> {"mime_type": ..., "data": ...}

SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
SUPPORTED_VIDEO_TYPES = [
    "video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv",
    "video/mpg", "video/webm", "video/wmv", "video/3gpp"
]
SUPPORTED_MEDIA_TYPES = SUPPORTED_IMAGE_TYPES + SUPPORTED_VIDEO_TYPES

class VisionResponse(BaseModel):
    text: str | None = None
    error: str | None = None

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

async def generate_response_with_retry(chat, prompt, media_part, retries=0):
    try:
        response = chat.send_message([prompt, media_part])  # No await here, it's a blocking call
        response.resolve()
        return response
    except ResourceExhausted as e:
        if retries < MAX_RETRIES:
            retries += 1
            print(f"Rate limit hit, retrying in {RETRY_DELAY} seconds...")
            time.sleep(RETRY_DELAY)
            return await generate_response_with_retry(chat, prompt, media_part, retries)
        else:
            raise Exception("Max retries reached, rate limit exceeded.")

@app.post("/analyze-media", response_model=VisionResponse)
async def analyze_media(
    prompt: str = Form(...),
    media_file: UploadFile = File(...),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4()))
):
    """
    Uploads media + prompt and initializes a chat session.
    Returns session ID and first response.
    """
    content_type = media_file.content_type
    if content_type not in SUPPORTED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported media type.")

    contents = await media_file.read()

    # Store media per session
    user_media[session_id] = {"mime_type": content_type, "data": contents}

    # Start a new chat session
    model = genai.GenerativeModel("gemini-1.5-flash")
    chat = model.start_chat()
    user_sessions[session_id] = chat

    media_part = {"mime_type": content_type, "data": contents}
    response = await generate_response_with_retry(chat, prompt, media_part)

    return VisionResponse(text=response.text)

@app.post("/ask", response_model=VisionResponse)
async def ask_followup(
    prompt: str = Form(...),
    session_id: str = Form(...)
):
    """
    Sends follow-up question using stored media and chat session.
    """
    if session_id not in user_sessions or session_id not in user_media:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    chat = user_sessions[session_id]
    media_part = user_media[session_id]

    try:
        response = await generate_response_with_retry(chat, prompt, media_part)
        return VisionResponse(text=response.text)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to generate response: {str(e)}"}
        )

@app.get("/")
async def root():
    return {"message": "VisionNav Backend with Context is running!"}

if __name__ == "__main__":
    import uvicorn
    from pyngrok import ngrok, conf
    
    conf.get_default().auth_token = "2wDxpHQEtvPtZFXOD5ruUvAfDMK_4nAZ7EEQLSgrnw4TZ1usF"

    # Set the port
    port = 8000

    # Open a tunnel on the specified port
    public_url = ngrok.connect(port)
    print(f" * ngrok tunnel: {public_url}")

    # Run FastAPI with uvicorn
    uvicorn.run("model.py", host="0.0.0.0", port=port, reload=True)
