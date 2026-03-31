from fastapi import APIRouter, HTTPException, Depends
from canvasapi import Canvas
import os
import re
from pydantic import BaseModel
from sqlalchemy.orm import Session
# Assuming these exist in your services/db.py
from ..services.db import get_db 

router = APIRouter()

# Configuration
CANVAS_API_URL = "https://asu.instructure.com"
# We pull this from environment, but in a multi-user app, 
# this would eventually come from the 'auth' module.
CANVAS_ACCESS_TOKEN = os.getenv("CANVAS_ACCESS_TOKEN")

class SyncResponse(BaseModel):
    status: str
    course_name: str
    items_synced: int

def clean_html(raw_html: str) -> str:
    """Removes HTML tags for cleaner RAG processing."""
    if not raw_html:
        return ""
    return re.sub(re.compile('<.*?>'), '', raw_html).strip()

@router.post("/sync/{course_id}", response_model=SyncResponse)
async def sync_course(course_id: int, db: Session = Depends(get_db)):
    """
    Fetches data from Canvas and prepares it for the DB.
    Accessed at: /fetch/sync/{course_id}
    """
    if not CANVAS_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="Canvas Token not configured")

    try:
        canvas = Canvas(CANVAS_API_URL, CANVAS_ACCESS_TOKEN)
        course = canvas.get_course(course_id)
        
        extracted_content = []

        # 1. Syllabus
        if hasattr(course, 'syllabus_body') and course.syllabus_body:
            extracted_content.append({
                "type": "syllabus",
                "title": "Syllabus",
                "content": clean_html(course.syllabus_body)
            })

        # 2. Assignments
        for assignment in course.get_assignments():
            if hasattr(assignment, 'description') and assignment.description:
                extracted_content.append({
                    "type": "assignment",
                    "title": assignment.name,
                    "content": clean_html(assignment.description)
                })

        # 3. Pages
        for page in course.get_pages():
            full_page = course.get_page(page.url)
            if hasattr(full_page, 'body') and full_page.body:
                extracted_content.append({
                    "type": "page",
                    "title": full_page.title,
                    "content": clean_html(full_page.body)
                })

        # NOTE FOR HUNTER/SHINNO:
        # Here is where you would iterate through 'extracted_content' 
        # and save them to your domain_models using the 'db' session.
        # Example: 
        # for item in extracted_content:
        #    new_doc = Document(title=item['title'], content=item['content'])
        #    db.add(new_doc)
        # db.commit()

        return SyncResponse(
            status="success",
            course_name=course.name,
            items_synced=len(extracted_content)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Canvas Sync Error: {str(e)}")