from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.ads import Advertiser


def get_wallet_balance(db: Session, *, advertiser_id: str) -> Decimal:
    advertiser = db.query(Advertiser).filter(Advertiser.id == advertiser_id).first()
    if advertiser is None:
        raise ValueError("Advertiser not found")
    return Decimal(str(advertiser.wallet_balance))


def deposit_funds(db: Session, *, advertiser_id: str, amount_usd: Decimal) -> tuple[Decimal, Decimal]:
    advertiser = db.query(Advertiser).filter(Advertiser.id == advertiser_id).first()
    if advertiser is None:
        raise ValueError("Advertiser not found")
    current = Decimal(str(advertiser.wallet_balance))
    new_balance = current + amount_usd
    advertiser.wallet_balance = new_balance
    db.commit()
    db.refresh(advertiser)
    return Decimal(str(advertiser.wallet_balance)), amount_usd