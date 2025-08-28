from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import CandidateFiltered
from ..schemas import CandidateDTO

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.get("", response_model=list[CandidateDTO])
def list_candidates(limit: int = 20, db: Session = Depends(get_db)):
    q = (
        db.query(CandidateFiltered)
        .order_by(
            CandidateFiltered.first_seen_at.desc(), CandidateFiltered.score.desc()
        )
        .limit(limit)
    )
    out = []
    for r in q:
        rs = r.reasons_json or {}
        out.append(
            CandidateDTO(
                ticker=r.ticker,
                price=rs.get("price", 0.0),
                rvol=rs.get("rvol", 0.0),
                score=float(r.score),
                reasons=rs.get("rules", {}),
            )
        )
    return out
