from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import require_user
from app.database import get_db
from app.models import DocTemplate, GeneratedDocument, KnowledgeDoc, Project
from app.schemas import SearchResult

router = APIRouter(prefix="/api/search", tags=["search"])

RESULTS_PER_CATEGORY = 6


@router.get("", response_model=list[SearchResult])
def search(q: str = Query(default=""), db: Session = Depends(get_db), _user: str = Depends(require_user)):
    term = q.strip()
    if len(term) < 2:
        return []
    pattern = f"%{term}%"
    results: list[SearchResult] = []

    projects = (
        db.query(Project)
        .filter((Project.name.ilike(pattern)) | (Project.customer.ilike(pattern)))
        .limit(RESULTS_PER_CATEGORY)
        .all()
    )
    results += [
        SearchResult(type="project", id=p.id, title=p.name, subtitle=p.customer, url=f"/projects/{p.id}")
        for p in projects
    ]

    documents = (
        db.query(GeneratedDocument).filter(GeneratedDocument.title.ilike(pattern)).limit(RESULTS_PER_CATEGORY).all()
    )
    results += [
        SearchResult(type="document", id=d.id, title=d.title, subtitle=f"{d.type} · {d.project}", url=f"/documents/{d.id}")
        for d in documents
    ]

    templates = db.query(DocTemplate).filter(DocTemplate.name.ilike(pattern)).limit(RESULTS_PER_CATEGORY).all()
    results += [
        SearchResult(type="template", id=t.id, title=t.name, subtitle=t.cloud, url=f"/templates/{t.id}")
        for t in templates
    ]

    knowledge = db.query(KnowledgeDoc).filter(KnowledgeDoc.name.ilike(pattern)).limit(RESULTS_PER_CATEGORY).all()
    results += [
        SearchResult(type="knowledge", id=k.id, title=k.name, subtitle=k.category, url="/knowledge-base")
        for k in knowledge
    ]

    return results
