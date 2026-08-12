import pytest
from app.api.v1.documents import process_document_background
from app.core.database import SessionLocal
from app.models.models import User, Document

@pytest.mark.anyio
async def test_process_document_background_non_existent():
    # Test background task with non-existent document ID
    await process_document_background(
        document_id="non-existent-id",
        file_path="/tmp/fake.pdf",
        file_type="pdf",
        user_id="fake-user",
        filename="fake.pdf"
    )
