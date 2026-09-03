"""
Background jobs for virtual number billing automation
- Auto-renewal processing
- Number expiration handling
- Payment processing
"""

import logging
from database import db
from datetime import datetime, timezone, timedelta
import os
import asyncio

logger = logging.getLogger(__name__)

# Main uvicorn event loop — set during startup so APScheduler threads can
# schedule coroutines on it via run_coroutine_threadsafe.
_main_loop: asyncio.AbstractEventLoop | None = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop
    logger.info("✅ Main event loop captured for APScheduler wrappers")


def get_main_loop() -> asyncio.AbstractEventLoop | None:
    return _main_loop


def _run_async(coro):
    """Run a coroutine on the main uvicorn event loop from an APScheduler thread."""
    global _main_loop
    if _main_loop is None or _main_loop.is_closed():
        logger.error("❌ Main event loop not set or closed — cannot run async job")
        return {"success": False, "error": "Event loop unavailable"}
    future = asyncio.run_coroutine_threadsafe(coro, _main_loop)
    try:
        return future.result(timeout=55)  # 55s < 60s job interval
    except Exception as e:
        logger.error(f"❌ Async job timed out or failed: {e}")
        return {"success": False, "error": str(e)}


ADMIN_EMAILS = [
    "astor539@gmail.com",
    "alinmy77@gmail.com",
    "worl212211@yahoo.com",
    "admin@calliotel.com",
    "bigboss@calliotel.com",
]


async def _notify_admins(subject: str, html: str):
    """Send internal notification email to all admin superusers."""
    try:
        from services.resend_service import send_email
        for a in ADMIN_EMAILS:
            try:
                await send_email(a, subject, html)
                await asyncio.sleep(0.6)  # stay under Resend's 2 req/sec rate limit
            except Exception as e:
                logger.warning(f"Admin notify failed for {a}: {e}")
    except Exception as e:
        logger.error(f"_notify_admins failed: {e}")


async def _release_telnyx_number(phone_number: str, number_id: str = None) -> bool:
    """Release a number from Telnyx. Uses stored number_id, DB lookup, or Telnyx API fallback."""
    from services.telnyx_client import release_number, lookup_number_id
    if not number_id:
        try:
            db = get_db()
            rec = await db.user_numbers.find_one({"phone_number": phone_number})
            if rec:
                number_id = rec.get("number_id")
        except Exception as e:
            logger.warning(f"Could not look up number_id for {phone_number} in DB: {e}")
    if not number_id:
        try:
            number_id = await lookup_number_id(phone_number)
            if number_id:
                logger.info(f"Resolved number_id for {phone_number} via Telnyx API: {number_id}")
                try:
                    db = get_db()
                    await db.user_numbers.update_one(
                        {"phone_number": phone_number},
                        {"$set": {"number_id": number_id}}
                    )
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Telnyx API lookup failed for {phone_number}: {e}")
    if not number_id:
        logger.warning(f"No number_id found for {phone_number} — cannot release from Telnyx")
        return False
    try:
        ok = await release_number(number_id, phone_number=phone_number)
        logger.info(f"{'✅' if ok else '❌'} Telnyx release {phone_number} (id={number_id}): {ok}")
        return ok
    except Exception as e:
        logger.error(f"Error releasing Telnyx number {phone_number}: {e}")
        return False


def get_db():
    """Return the shared database connection."""
    return db


async def process_auto_renewals():
    """
    Process auto-renewals for virtual numbers.
    Called daily via cron job.
    
    Logic:
    1. Find all numbers where:
       - auto_renew = True
       - next_billing_date <= today
       - status = active
       - cancel_requested = False
    2. For each number:
       - Check user's wallet balance
       - Deduct monthly_cost from wallet
       - Update next_billing_date (+30 days)
       - Log transaction
       - Send confirmation email (future)
    """
    try:
        logger.info("🔄 Starting auto-renewal job...")
        
        db = get_db()  # Get fresh DB connection for this job run
        today = datetime.now(timezone.utc)
        
        # Find numbers due for renewal
        cursor = db.purchased_numbers.find({
            "auto_renew": True,
            "status": "active",
            "cancel_requested": False,
            "next_billing_date": {"$lte": today.isoformat()}
        })
        
        numbers_to_renew = await cursor.to_list(length=1000)
        
        if not numbers_to_renew:
            logger.info("✅ No numbers due for renewal today")
            return {
                "success": True,
                "renewed": 0,
                "failed": 0,
                "message": "No renewals due"
            }
        
        logger.info(f"📞 Found {len(numbers_to_renew)} numbers due for renewal")
        
        renewed_count = 0
        failed_count = 0
        
        for number in numbers_to_renew:
            try:
                phone_number = number["phone_number"]
                monthly_cost = number["monthly_cost"]
                user_id = number["user_id"]
                
                # Get user's wallet
                wallet = await db.wallets.find_one({"user_id": user_id})
                
                if not wallet:
                    logger.warning(f"❌ No wallet found for user {user_id}, number {phone_number}")
                    failed_count += 1
                    continue
                
                # Check balance
                if wallet["balance"] < monthly_cost:
                    logger.warning(f"💰 Insufficient balance for {phone_number}. Required: ${monthly_cost}, Available: ${wallet['balance']}")
                    
                    # Mark number for expiration (grace period: 7 days)
                    from datetime import timedelta
                    grace_end = datetime.now(timezone.utc) + timedelta(days=7)
                    
                    await db.purchased_numbers.update_one(
                        {"_id": number["_id"]},
                        {
                            "$set": {
                                "status": "suspended",
                                "suspension_reason": "insufficient_balance",
                                "grace_period_end": grace_end.isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    )
                    
                    logger.info(f"⏸️ Number {phone_number} suspended. Grace period until {grace_end.date()}")
                    failed_count += 1
                    continue
                
                # Deduct from wallet
                new_balance = wallet["balance"] - monthly_cost
                await db.wallets.update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "balance": new_balance,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                # Log transaction
                transaction = {
                    "user_id": user_id,
                    "type": "debit",
                    "amount": monthly_cost,
                    "description": f"Monthly renewal for {phone_number}",
                    "phone_number": phone_number,
                    "balance_after": new_balance,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.transactions.insert_one(transaction)
                
                # Update next billing date (+30 days)
                from datetime import timedelta
                next_billing = datetime.now(timezone.utc) + timedelta(days=30)
                
                await db.purchased_numbers.update_one(
                    {"_id": number["_id"]},
                    {
                        "$set": {
                            "next_billing_date": next_billing.isoformat(),
                            "last_renewed_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                logger.info(f"✅ Renewed {phone_number} for ${monthly_cost}. Next billing: {next_billing.date()}")
                renewed_count += 1
                
                # TODO: Send confirmation email via Resend
                
            except Exception as e:
                logger.error(f"❌ Error renewing {number.get('phone_number', 'unknown')}: {str(e)}")
                failed_count += 1
        
        logger.info(f"🎉 Auto-renewal job complete. Renewed: {renewed_count}, Failed: {failed_count}")
        
        return {
            "success": True,
            "renewed": renewed_count,
            "failed": failed_count,
            "total_processed": len(numbers_to_renew)
        }
        
    except Exception as e:
        logger.error(f"❌ Auto-renewal job failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


async def process_didww_renewals():
    """
    Process Telnyx user_numbers renewals.
    CRITICAL: If auto_renew=False OR insufficient balance, RELEASE the number from Telnyx
    so we STOP paying the provider.
    """
    try:
        logger.info("🔄 Starting Telnyx number renewal job...")
        db = get_db()
        today = datetime.now(timezone.utc)

        cursor = db.user_numbers.find({
            "status": "active",
            "next_renewal_date": {"$lte": today.isoformat()}
        })
        subs = await cursor.to_list(length=1000)

        if not subs:
            logger.info("✅ No number subs due for renewal")
            return {"success": True, "renewed": 0, "released": 0}

        renewed = 0
        released = 0

        # Pricing math lives in telnyx_routes — import here so the discount
        # schedule never drifts between purchase-time and renewal-time.
        from routes.telnyx_routes import (
            _duration_total as _didww_duration_total,
            DURATION_DISCOUNTS as _DIDWW_DURATION_DISCOUNTS,
        )

        for sub in subs:
            phone = sub.get("phone_number")
            user_id = sub.get("user_id")
            user_email = sub.get("user_email", "")
            auto_renew = bool(sub.get("auto_renew", False))

            # Determine the renewal *plan length* — same length as the original
            # purchase (so an annual customer renews as another annual term).
            # Default to 1 month for legacy subs that pre-date the duration field.
            sub_months = int(sub.get("subscription_months", 1) or 1)
            if sub_months not in _DIDWW_DURATION_DISCOUNTS:
                sub_months = 1  # safety net for malformed legacy data

            # Renewal charge resolution (in priority order):
            # 1) New subs: stored provider_cost + recompute via current discount table
            # 2) Stored total_paid / monthly_equivalent (annual subs always have these)
            # 3) Legacy monthly subs: just charge stored monthly_cost (no recompute —
            #    we don't reverse-engineer wholesale from retail because the markup
            #    tiers have changed historically and we'd over/under-bill the customer)
            stored_provider_cost = sub.get("provider_cost")
            if stored_provider_cost:
                try:
                    renewal_total, renewal_per_mo, renewal_disc_pct = _didww_duration_total(
                        float(stored_provider_cost), sub_months,
                    )
                except Exception:
                    renewal_total = float(sub.get("total_paid") or sub.get("monthly_cost", 0))
                    renewal_per_mo = float(sub.get("monthly_equivalent") or sub.get("monthly_cost", 0))
                    renewal_disc_pct = int(sub.get("discount_pct", 0) or 0)
            elif sub.get("total_paid") and sub_months > 1:
                # Annual sub with no provider_cost — honor the price they paid
                renewal_total = float(sub["total_paid"])
                renewal_per_mo = float(sub.get("monthly_equivalent") or renewal_total / sub_months)
                renewal_disc_pct = int(sub.get("discount_pct", 0) or 0)
            else:
                # Legacy monthly sub — charge the exact stored monthly_cost
                renewal_total = float(sub.get("monthly_cost", 0))
                renewal_per_mo = renewal_total
                renewal_disc_pct = 0
                sub_months = 1  # force monthly cadence for legacy data

            # Legacy log/email field — for monthly subs this equals the plan total,
            # for annual subs this is the discounted per-month equivalent.
            monthly_cost = renewal_per_mo

            try:
                wallet = await db.wallets.find_one({"user_id": user_id})
                balance = float(wallet.get("balance", 0)) if wallet else 0.0

                # Case A: auto-renew OFF OR insufficient balance for the full plan
                # → release from DIDWW. For annual plans we require the FULL plan
                # total (e.g. $15.55), not the monthly equivalent — otherwise we'd
                # silently downgrade the customer's plan length at renewal.
                if not auto_renew or balance < renewal_total:
                    reason = "auto_renew_off" if not auto_renew else "insufficient_balance"
                    logger.warning(f"🛑 NOT renewing {phone} ({reason}). Releasing from Telnyx to stop provider charge.")

                    number_id = sub.get("number_id")
                    active_conflict = await db.user_numbers.find_one({
                        "phone_number": phone,
                        "status": "active",
                        "_id": {"$ne": sub["_id"]},
                        "number_id": {"$ne": number_id},
                    })
                    if active_conflict:
                        logger.error(
                            f"Release skipped for stale assignment {phone} ({number_id}): "
                            f"number is active under newer id {active_conflict.get('number_id')}"
                        )
                        deleted = True
                    else:
                        deleted = await _release_telnyx_number(phone, number_id=number_id)

                    # If release failed, keep as release_pending so we retry tomorrow
                    new_status = "expired" if deleted else "release_pending"
                    update_fields = {
                        "status": new_status,
                        "expiration_reason": reason,
                        "provider_released": deleted,
                        "last_release_attempt_at": datetime.now(timezone.utc).isoformat(),
                    }
                    if deleted:
                        update_fields["expired_at"] = datetime.now(timezone.utc).isoformat()
                    else:
                        # Retry tomorrow
                        update_fields["next_renewal_date"] = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

                    await db.user_numbers.update_one(
                        {"_id": sub["_id"]},
                        {"$set": update_fields}
                    )
                    await db.number_expirations.insert_one({
                        "phone_number": phone,
                        "user_id": user_id,
                        "reason": reason,
                        "provider_released": deleted,
                        "expired_at": datetime.now(timezone.utc).isoformat(),
                    })

                    # Notify admins
                    await _notify_admins(
                        f"Calliotel — Number {phone} RELEASED",
                        f"<h3>Number released from Telnyx</h3>"
                        f"<p><b>Number:</b> {phone}</p>"
                        f"<p><b>User:</b> {user_email or user_id}</p>"
                        f"<p><b>Reason:</b> {reason}</p>"
                        f"<p><b>Telnyx release OK:</b> {deleted}</p>"
                    )
                    # Notify user
                    if user_email:
                        try:
                            from services.resend_service import send_email
                            await send_email(
                                user_email,
                                f"Your Calliotel number {phone} was not renewed",
                                f"<p>Your virtual number <b>{phone}</b> has expired "
                                f"({'auto-renew was off' if reason == 'auto_renew_off' else 'insufficient balance'}) "
                                f"and has been released. To keep a number, add credits and re-purchase.</p>"
                            )
                        except Exception as e:
                            logger.warning(f"User email failed: {e}")
                    released += 1
                    continue

                # Case B: auto-renew + balance OK → charge full plan total & extend
                # by the same plan length (annual stays annual, monthly stays monthly).
                #
                # Atomic safety net: claim this sub by advancing its next_renewal_date
                # *first*, conditional on the date we just read. If two job runs race
                # (e.g. scheduler glitch / restart), only one will match the conditional
                # update and proceed to debit — the loser will see modified_count=0 and
                # skip the row, preventing double-billing.
                cur_next = sub.get("next_renewal_date")
                # Snapshot fields we'll mutate on the claim so the rollback can
                # restore them symmetrically if the wallet debit loses a race.
                rollback_snapshot = {
                    "next_renewal_date": cur_next,
                    "expires_at": sub.get("expires_at"),
                    "monthly_equivalent": sub.get("monthly_equivalent"),
                    "total_paid": sub.get("total_paid"),
                    "discount_pct": sub.get("discount_pct"),
                }
                next_date = (datetime.now(timezone.utc) + timedelta(days=30 * sub_months)).isoformat()
                claim = await db.user_numbers.update_one(
                    {"_id": sub["_id"], "next_renewal_date": cur_next, "status": "active"},
                    {"$set": {
                        "next_renewal_date": next_date,
                        "expires_at": next_date,
                        "last_renewed_at": datetime.now(timezone.utc).isoformat(),
                        "monthly_equivalent": renewal_per_mo,
                        "total_paid": renewal_total,
                        "discount_pct": renewal_disc_pct,
                    }}
                )
                if claim.modified_count != 1:
                    logger.warning(f"⏭️ Skipping {phone}: already claimed by another renewal pass")
                    continue

                # Atomic wallet debit: only deduct if balance is still ≥ renewal_total.
                # This guards against the customer's balance dropping between our read
                # above and this write (e.g. they bought another number in parallel).
                debit = await db.wallets.update_one(
                    {"user_id": user_id, "balance": {"$gte": renewal_total}},
                    {"$inc": {"balance": -renewal_total},
                     "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                if debit.modified_count != 1:
                    # Race lost — funds vanished between read and debit. Roll back ALL
                    # claim-side mutations symmetrically so state is exactly as we found
                    # it and the next renewal pass can retry cleanly. Drop None values
                    # via $unset so we don't write nulls where fields were previously
                    # absent (prevents triggering false multi-month logic on legacy subs).
                    set_back, unset_back = {}, {}
                    for k, v in rollback_snapshot.items():
                        if v is None:
                            unset_back[k] = ""
                        else:
                            set_back[k] = v
                    unset_back["last_renewed_at"] = ""
                    rollback_op = {}
                    if set_back:
                        rollback_op["$set"] = set_back
                    if unset_back:
                        rollback_op["$unset"] = unset_back
                    try:
                        await db.user_numbers.update_one(
                            {"_id": sub["_id"]}, rollback_op
                        )
                    except Exception as rb_err:
                        # Rollback itself failed — bounded blast radius: the customer
                        # gets at most ONE extra renewal cycle of free service (they
                        # were never actually charged). Loudly alert admins so a human
                        # can reconcile. We do NOT retry the debit here because the
                        # customer's wallet is already in a known-good state.
                        logger.error(f"🚨 Renewal rollback FAILED for {phone}: {rb_err} — customer not charged but next_renewal advanced. MANUAL RECONCILE NEEDED.")
                        try:
                            await _notify_admins(
                                f"🚨 Renewal rollback failed for {phone} — manual reconcile",
                                f"<h3>Renewal job: rollback after wallet race FAILED</h3>"
                                f"<p>Number: {phone}<br>User: {user_email or user_id}</p>"
                                f"<p>The customer was NOT charged (wallet race lost), but the "
                                f"subscription's next_renewal_date was advanced and we couldn't "
                                f"roll it back. Worst case: ~{30 * sub_months} days of free service. "
                                f"Please reset next_renewal_date to {cur_next} or charge them ${renewal_total:.2f} manually.</p>"
                                f"<p>DB error: {rb_err}</p>"
                            )
                        except Exception:
                            pass
                    logger.warning(f"⏭️ Skipping {phone}: wallet race lost (balance dropped). Will retry.")
                    continue

                new_wallet = await db.wallets.find_one({"user_id": user_id})
                new_balance = float((new_wallet or {}).get("balance", 0))
                plan_label = (
                    f"{sub_months}-month plan ({renewal_disc_pct}% off)"
                    if sub_months > 1 else "monthly plan"
                )
                await db.transactions.insert_one({
                    "user_id": user_id,
                    "type": "debit",
                    "amount": renewal_total,
                    "description": f"Auto-renewal for {phone} — {plan_label}",
                    "phone_number": phone,
                    "subscription_months": sub_months,
                    "discount_pct": renewal_disc_pct,
                    "balance_after": new_balance,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })

                # Admin notification
                await _notify_admins(
                    f"Calliotel — Number {phone} auto-renewed",
                    f"<h3>ADMIN — YOUR NUMBER {phone} SUCCESSFULLY RENEWED</h3>"
                    f"<p><b>User:</b> {user_email or user_id}</p>"
                    f"<p><b>Plan:</b> {plan_label}</p>"
                    f"<p><b>Charged:</b> ${renewal_total:.2f} (${renewal_per_mo:.2f}/mo equiv)</p>"
                    f"<p><b>New balance:</b> ${new_balance:.2f}</p>"
                    f"<p><b>Next renewal:</b> {next_date}</p>"
                )
                logger.info(f"✅ Renewed {phone} for ${renewal_total} ({plan_label})")
                renewed += 1

            except Exception as e:
                logger.error(f"Renewal error for {phone}: {e}")

        return {"success": True, "renewed": renewed, "released": released, "total": len(subs)}

    except Exception as e:
        logger.error(f"❌ Number renewal job failed: {e}")
        return {"success": False, "error": str(e)}


async def process_expirations():
    """
    Process number expirations and cancellations.
    Called daily via cron job.
    
    Logic:
    1. Find all numbers where:
       - cancel_requested = True
       - cancel_effective_date <= today
       - status = active
    2. For each number:
       - Update status to "expired"
       - Optionally release from Telnyx provider
       - Log the expiration
       - Send confirmation email (future)
    
    3. Also handle suspended numbers past grace period
    """
    try:
        logger.info("📅 Starting expiration job...")
        
        db = get_db()  # Get fresh DB connection for this job run
        today = datetime.now(timezone.utc)
        
        # Find cancelled numbers that should expire today
        cursor_cancelled = db.purchased_numbers.find({
            "cancel_requested": True,
            "status": "active",
            "cancel_effective_date": {"$lte": today.isoformat()}
        })
        
        # Find suspended numbers past grace period
        cursor_suspended = db.purchased_numbers.find({
            "status": "suspended",
            "grace_period_end": {"$lte": today.isoformat()}
        })
        
        cancelled_numbers = await cursor_cancelled.to_list(length=1000)
        suspended_numbers = await cursor_suspended.to_list(length=1000)
        
        numbers_to_expire = cancelled_numbers + suspended_numbers
        
        if not numbers_to_expire:
            logger.info("✅ No numbers due for expiration today")
            return {
                "success": True,
                "expired": 0,
                "message": "No expirations due"
            }
        
        logger.info(f"📞 Found {len(numbers_to_expire)} numbers to expire")
        
        expired_count = 0
        
        for number in numbers_to_expire:
            try:
                phone_number = number["phone_number"]
                
                # Update status to expired
                await db.purchased_numbers.update_one(
                    {"_id": number["_id"]},
                    {
                        "$set": {
                            "status": "expired",
                            "expired_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                # Log expiration event
                expiration_log = {
                    "phone_number": phone_number,
                    "user_id": number["user_id"],
                    "reason": "cancelled" if number.get("cancel_requested") else "suspended",
                    "expired_at": datetime.now(timezone.utc).isoformat()
                }
                await db.number_expirations.insert_one(expiration_log)
                
                # Note: legacy purchased_numbers — Telnyx release handled in billing_jobs._release_telnyx_number
                
                logger.info(f"✅ Expired {phone_number}")
                expired_count += 1
                
                # TODO: Send expiration confirmation email via Resend
                
            except Exception as e:
                logger.error(f"❌ Error expiring {number.get('phone_number', 'unknown')}: {str(e)}")
        
        logger.info(f"🎉 Expiration job complete. Expired: {expired_count}")
        
        return {
            "success": True,
            "expired": expired_count,
            "total_processed": len(numbers_to_expire)
        }
        
    except Exception as e:
        logger.error(f"❌ Expiration job failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


async def send_renewal_reminders():
    """
    Send email reminders before renewal date.
    Called daily via cron job.

    Covers BOTH collections:
    - user_numbers  (Telnyx numbers — all current customers)
    - purchased_numbers (legacy DIDWW numbers)

    Schedule:
    - 7 days before: friendly heads-up (all active numbers)
    - 48 hours before: urgent warning — if balance is low, tells user to top up
                        if auto_renew=OFF, warns number will be cancelled
    """
    try:
        logger.info("📧 Starting renewal reminder job...")
        from services.resend_service import send_email

        db = get_db()
        today = datetime.now(timezone.utc)
        seven_days_date = (today + timedelta(days=7)).date()
        two_days_date = (today + timedelta(days=2)).date()

        reminder_count = 0

        async def _send_7day(phone_number, user_email, monthly_cost, auto_renew):
            subject = f"Your Calliotel number renews in 7 days"
            renew_note = (
                f"Your number will <b>auto-renew for ${monthly_cost:.2f}</b> — make sure your wallet has enough balance."
                if auto_renew else
                f"Your number will <b>expire in 7 days</b> unless you top up and enable auto-renew."
            )
            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
              <h2 style="color:#4f46e5;">📞 Renewal Reminder</h2>
              <p>Hi there,</p>
              <p>Your virtual number <b>{phone_number}</b> renews in <b>7 days</b>.</p>
              <p>{renew_note}</p>
              <p style="margin-top:24px;">
                <a href="https://calliotel.com/wallet" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Top Up Wallet</a>
              </p>
              <p style="color:#888;font-size:12px;margin-top:32px;">Calliotel — Virtual Phone Numbers</p>
            </div>
            """
            await send_email(user_email, subject, html)

        async def _send_48h(phone_number, user_email, monthly_cost, balance, auto_renew):
            if not auto_renew:
                subject = f"⚠️ Your Calliotel number expires in 48 hours"
                body = f"Auto-renew is <b>OFF</b> for your number <b>{phone_number}</b>. It will be <b>cancelled in 48 hours</b>. Enable auto-renew and top up your wallet to keep it."
            elif balance < monthly_cost:
                subject = f"⚠️ Low balance — your number {phone_number} may not renew"
                body = (
                    f"Your wallet balance is <b>${balance:.2f}</b> but your number <b>{phone_number}</b> "
                    f"costs <b>${monthly_cost:.2f}/month</b>. "
                    f"Please top up at least <b>${monthly_cost - balance:.2f}</b> in the next 48 hours or your number will be cancelled."
                )
            else:
                subject = f"Your Calliotel number renews in 48 hours"
                body = f"Your number <b>{phone_number}</b> will auto-renew for <b>${monthly_cost:.2f}</b> in 48 hours. Your balance is ${balance:.2f} ✅"

            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
              <h2 style="color:#dc2626;">⚠️ 48-Hour Notice</h2>
              <p>Hi there,</p>
              <p>{body}</p>
              <p style="margin-top:24px;">
                <a href="https://calliotel.com/wallet" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Top Up Wallet</a>
              </p>
              <p style="color:#888;font-size:12px;margin-top:32px;">Calliotel — Virtual Phone Numbers</p>
            </div>
            """
            await send_email(user_email, subject, html)

        # ── user_numbers (Telnyx — all current customers) ──────────────────
        telnyx_numbers = await db.user_numbers.find({"status": "active"}).to_list(length=5000)
        # Batch-load users + wallets (avoid N+1)
        uid_set = {n.get("user_id") for n in telnyx_numbers if n.get("user_id")}
        uid_list = list(uid_set)
        user_map = {}
        wallet_map = {}
        if uid_list:
            users = await db.users.find({"_id": {"$in": uid_list}}, {"email": 1}).to_list(length=len(uid_list) + 10)
            user_map = {u["_id"]: u for u in users}
            wallets = await db.wallets.find({"user_id": {"$in": uid_list}}).to_list(length=len(uid_list) + 10)
            wallet_map = {w["user_id"]: w for w in wallets}

        for num in telnyx_numbers:
            try:
                renewal_str = num.get("next_renewal_date") or num.get("expires_at")
                if not renewal_str:
                    continue
                renewal_date = datetime.fromisoformat(renewal_str.replace('Z', '+00:00')).date()
                user_email = num.get("user_email") or ""
                if not user_email or "@" not in user_email:
                    user = user_map.get(num.get("user_id"))
                    user_email = (user or {}).get("email", "") or (num.get("user_id") if isinstance(num.get("user_id"), str) and "@" in str(num.get("user_id")) else "")
                if not user_email:
                    continue
                phone = num.get("phone_number", "")
                cost = float(num.get("monthly_cost", 0))
                auto_renew = bool(num.get("auto_renew", True))
                wallet = wallet_map.get(num.get("user_id"))
                balance = float((wallet or {}).get("balance", 0))

                if renewal_date == seven_days_date:
                    await _send_7day(phone, user_email, cost, auto_renew)
                    logger.info(f"📧 7-day reminder → {user_email} for {phone}")
                    reminder_count += 1
                elif renewal_date == two_days_date:
                    await _send_48h(phone, user_email, cost, balance, auto_renew)
                    logger.info(f"📧 48-hour reminder → {user_email} for {phone} (balance=${balance:.2f})")
                    reminder_count += 1
            except Exception as e:
                logger.error(f"❌ Telnyx reminder error for {num.get('phone_number')}: {e}")

        # ── purchased_numbers (legacy DIDWW) ───────────────────────────────
        legacy_numbers = await db.purchased_numbers.find({
            "status": "active",
            "cancel_requested": False
        }).to_list(length=1000)
        legacy_uids = list({n.get("user_id") for n in legacy_numbers if n.get("user_id")})
        if legacy_uids:
            users = await db.users.find({"_id": {"$in": legacy_uids}}, {"email": 1}).to_list(length=len(legacy_uids) + 10)
            for u in users:
                user_map[u["_id"]] = u
            wallets = await db.wallets.find({"user_id": {"$in": legacy_uids}}).to_list(length=len(legacy_uids) + 10)
            for w in wallets:
                wallet_map[w["user_id"]] = w

        for number in legacy_numbers:
            try:
                billing_str = number.get("next_billing_date")
                if not billing_str:
                    continue
                billing_date = datetime.fromisoformat(billing_str.replace('Z', '+00:00')).date()
                user = user_map.get(number.get("user_id"))
                user_email = (user or {}).get("email", "")
                if not user_email:
                    continue
                phone = number.get("phone_number", "")
                cost = float(number.get("monthly_cost", 0))
                auto_renew = bool(number.get("auto_renew", True))
                wallet = wallet_map.get(number.get("user_id"))
                balance = float((wallet or {}).get("balance", 0))

                if billing_date == seven_days_date:
                    await _send_7day(phone, user_email, cost, auto_renew)
                    logger.info(f"📧 7-day reminder (legacy) → {user_email} for {phone}")
                    reminder_count += 1
                elif billing_date == two_days_date:
                    await _send_48h(phone, user_email, cost, balance, auto_renew)
                    logger.info(f"📧 48-hour reminder (legacy) → {user_email} for {phone}")
                    reminder_count += 1
            except Exception as e:
                logger.error(f"❌ Legacy reminder error for {number.get('phone_number')}: {e}")

        logger.info(f"🎉 Reminder job complete. Sent: {reminder_count}")
        return {"success": True, "reminders_sent": reminder_count}

    except Exception as e:
        logger.error(f"❌ Reminder job failed: {str(e)}")
        return {"success": False, "error": str(e)}


# Synchronous wrappers for APScheduler (required because APScheduler doesn't support async directly)
def run_auto_renewals():
    """Synchronous wrapper for auto-renewal job"""
    try:
        result = _run_async(process_auto_renewals())
        try:
            from routes.number_pool import process_pool_renewals
            pool_result = _run_async(process_pool_renewals())
            logger.info(f"Pool renewals: {pool_result}")
        except Exception as pe:
            logger.warning(f"Pool renewals skipped: {pe}")
        return result
    except Exception as e:
        logger.error(f"Error in run_auto_renewals wrapper: {str(e)}")
        return {"success": False, "error": str(e)}


def run_didww_renewals():
    """Synchronous wrapper for Telnyx renewal job"""
    try:
        return _run_async(process_didww_renewals())
    except Exception as e:
        logger.error(f"Error in run_didww_renewals wrapper: {str(e)}")
        return {"success": False, "error": str(e)}


def run_expirations():
    """Synchronous wrapper for expiration job"""
    try:
        return _run_async(process_expirations())
    except Exception as e:
        logger.error(f"Error in run_expirations wrapper: {str(e)}")
        return {"success": False, "error": str(e)}


def run_renewal_reminders():
    """Synchronous wrapper for reminder job"""
    try:
        return _run_async(send_renewal_reminders())
    except Exception as e:
        logger.error(f"Error in run_renewal_reminders wrapper: {str(e)}")
        return {"success": False, "error": str(e)}




async def process_scheduled_messages():
    """
    Check and send scheduled messages/challenges that are due (Time-Bender feature)
    Called every minute via cron job
    Handles both regular messages and game challenges
    """
    try:
        logger.info("📅 Checking for scheduled messages...")
        
        db = get_db()  # Get fresh DB connection for this job run
        now = datetime.now(timezone.utc)
        
        # Find messages that are due to be sent
        cursor = db.scheduled_messages.find({
            "status": "pending",
            "scheduled_time": {"$lte": now.isoformat()}
        })
        
        messages_to_send = await cursor.to_list(length=1000)
        
        if not messages_to_send:
            logger.info("✅ No scheduled messages due")
            return {
                "success": True,
                "sent": 0,
                "message": "No messages due"
            }
        
        logger.info(f"📨 Found {len(messages_to_send)} messages to send")
        
        sent_count = 0
        failed_count = 0
        
        for message in messages_to_send:
            try:
                msg_id = message.get("id", message.get("_id"))
                sender_id = message["sender_id"]
                receiver_id = message.get("receiver_id", message.get("recipient_id"))
                content = message["content"]
                msg_type = message.get("type", message.get("message_type"))
                
                # TIME-BENDER: Handle challenge type
                if msg_type == "challenge" and message.get("challenge_config"):
                    # Send as game challenge
                    from uuid import uuid4
                    challenge_config = message["challenge_config"]
                    
                    challenge_doc = {
                        "id": str(uuid4()),
                        "challenger_id": sender_id,
                        "opponent_id": receiver_id,
                        "game_type": challenge_config["game_type"],
                        "wager_amount": challenge_config.get("wager_amount"),
                        "difficulty": challenge_config.get("difficulty", "medium"),
                        "chaos_mode": challenge_config.get("chaos_mode", False),
                        "message": content,
                        "status": "pending",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "expires_at": None
                    }
                    
                    await db.game_challenges.insert_one(challenge_doc)
                    
                    # Create system message in chat
                    game_names = {
                        "speed_dialer": "Speed Dialer",
                        "duel": "The Duel",
                        "phish_finder": "Phish-Finder"
                    }
                    
                    game_emojis = {
                        "speed_dialer": "⚡",
                        "duel": "⚔️",
                        "phish_finder": "🧠"
                    }
                    
                    game_name = game_names.get(challenge_config["game_type"], "Game")
                    game_emoji = game_emojis.get(challenge_config["game_type"], "🎮")
                    
                    system_message_content = f"{game_emoji} **Challenge:** {game_name}"
                    
                    if challenge_config.get("wager_amount"):
                        system_message_content += f" • {challenge_config['wager_amount']} XP wager"
                    
                    if challenge_config.get("difficulty"):
                        system_message_content += f" • {challenge_config['difficulty'].capitalize()}"
                    
                    if challenge_config.get("chaos_mode"):
                        system_message_content += " • 🔥 Chaos Mode"
                    
                    if content:
                        system_message_content += f"\n💬 \"{content}\""
                    
                    # Add "⏰ Scheduled Taunt" indicator
                    system_message_content += "\n⏰ Scheduled Taunt"
                    
                    from uuid import uuid4
                    system_msg = {
                        "id": str(uuid4()),
                        "sender_id": sender_id,
                        "receiver_id": receiver_id,
                        "content": system_message_content,
                        "type": "challenge",
                        "challenge_id": challenge_doc["id"],
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "read": False,
                        "reactions": []
                    }
                    
                    await db.messages.insert_one(system_msg)
                    
                    logger.info(f"⚔️ Sent scheduled challenge: {challenge_doc['id']}")
                    
                else:
                    # Send as regular message
                    from uuid import uuid4
                    new_message = {
                        "id": str(uuid4()),
                        "sender_id": sender_id,
                        "receiver_id": receiver_id,
                        "content": content,
                        "type": msg_type,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "read": False,
                        "scheduled": True  # Mark as scheduled message
                    }
                    
                    await db.messages.insert_one(new_message)
                    
                    logger.info(f"✅ Sent scheduled message: {msg_id}")
                
                # Update scheduled message status
                await db.scheduled_messages.update_one(
                    {"id": msg_id} if "id" in message else {"_id": msg_id},
                    {
                        "$set": {
                            "status": "sent",
                            "sent_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                sent_count += 1
                
            except Exception as e:
                logger.error(f"❌ Error sending message {message.get('id', message.get('_id'))}: {str(e)}")
                
                # Mark as failed
                msg_id_field = {"id": message.get("id")} if "id" in message else {"_id": message.get("_id")}
                await db.scheduled_messages.update_one(
                    msg_id_field,
                    {
                        "$set": {
                            "status": "failed",
                            "error": str(e),
                            "failed_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                failed_count += 1
        
        logger.info(f"🎉 Scheduled messages job complete. Sent: {sent_count}, Failed: {failed_count}")
        
        return {
            "success": True,
            "sent": sent_count,
            "failed": failed_count,
            "total_processed": len(messages_to_send)
        }
        
    except Exception as e:
        logger.error(f"❌ Scheduled messages job failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


def run_scheduled_messages():
    """Synchronous wrapper for scheduled messages job (APScheduler thread → main loop)"""
    return _run_async(process_scheduled_messages())



async def process_scheduled_video_messages():
    """
    Check and send scheduled video messages that are due
    Called every minute via cron job
    """
    try:
        logger.info("📹 Checking for scheduled video messages...")
        
        db = get_db()  # Get fresh DB connection for this job run
        now = datetime.now(timezone.utc)
        
        # Find video messages that are due to be sent
        cursor = db.scheduled_video_messages.find({
            "status": "scheduled",
            "scheduled_at": {"$lte": now.isoformat()}
        })
        
        videos_to_send = await cursor.to_list(length=100)
        
        if not videos_to_send:
            logger.info("✅ No scheduled video messages due")
            return {"success": True, "sent": 0, "message": "No videos due"}
        
        sent_count = 0
        failed_count = 0
        
        for video in videos_to_send:
            try:
                # Move from scheduled to regular messages
                video["status"] = "sent"
                video["timestamp"] = datetime.now(timezone.utc).isoformat()
                
                # Insert into messages collection
                await db.messages.insert_one(video)
                
                # Remove from scheduled collection
                await db.scheduled_video_messages.delete_one({"message_id": video["message_id"]})
                
                sent_count += 1
                logger.info(f"✅ Sent scheduled video: {video['message_id']}")
                
            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Failed to send video {video.get('message_id')}: {str(e)}")
                # Mark as failed
                await db.scheduled_video_messages.update_one(
                    {"message_id": video["message_id"]},
                    {"$set": {"status": "failed", "error": str(e)}}
                )
        
        logger.info(f"🎉 Scheduled video messages job complete. Sent: {sent_count}, Failed: {failed_count}")
        return {
            "success": True,
            "sent": sent_count,
            "failed": failed_count
        }
        
    except Exception as e:
        logger.error(f"❌ Scheduled video messages job failed: {str(e)}")
        return {"success": False, "error": str(e)}


def run_scheduled_video_messages():
    """Synchronous wrapper for scheduled video messages job (APScheduler thread → main loop)"""
    return _run_async(process_scheduled_video_messages())


# ── OTP Auto-Expiry Job ────────────────────────────────────────────────────────

async def process_otp_expirations():
    """
    Find all OTP orders that have expired (expires_at < now) and are still waiting.
    Cancel at HeroSMS and refund wallet — guarantees the 100% refund promise even
    if the user closed their browser tab and stopped polling.
    """
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        expired = await db.otp_orders.find(
            {"status": "waiting", "refunded": {"$ne": True}, "expires_at": {"$lt": now_iso}}
        ).to_list(length=100)

        if not expired:
            return {"success": True, "refunded": 0}

        import httpx
        HEROSMS_API_KEY = os.environ.get("HEROSMS_API_KEY", "")
        HEROSMS_BASE = "https://hero-sms.com/stubs/handler_api.php"
        refunded_count = 0

        for order in expired:
            try:
                order_id = order["order_id"]
                user_id  = order["user_id"]

                async with httpx.AsyncClient(timeout=10) as c:
                    st = await c.get(HEROSMS_BASE, params={
                        "api_key": HEROSMS_API_KEY,
                        "action": "getStatus",
                        "id": order_id,
                    })
                    body = (st.text or "").strip()
                if body.startswith("STATUS_OK"):
                    code = body.split(":", 1)[1] if ":" in body else body
                    await db.otp_orders.update_one(
                        {"order_id": order_id},
                        {"$set": {
                            "status": "got_sms",
                            "sms_code": code,
                            "sms_text": body,
                            "received_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                    logger.info(f"OTP expiry skipped refund — SMS already on {order_id}")
                    continue

                # Cancel at HeroSMS (status 8 = cancel)
                async with httpx.AsyncClient(timeout=10) as c:
                    await c.get(HEROSMS_BASE, params={
                        "api_key": HEROSMS_API_KEY,
                        "action": "setStatus",
                        "id": order_id,
                        "status": 8,
                    })

                # Refund wallet
                wallet = await db.wallets.find_one({"user_id": user_id})
                if wallet:
                    new_bal = float(wallet.get("balance", 0)) + order["price_paid"]
                    now_ts = datetime.now(timezone.utc).isoformat()
                    await db.wallets.update_one(
                        {"user_id": user_id},
                        {"$set": {"balance": new_bal, "updated_at": now_ts}}
                    )
                    await db.transactions.insert_one({
                        "user_id":      user_id,
                        "type":         "credit",
                        "amount":       order["price_paid"],
                        "description":  f"Auto-refund — OTP {order['service_name']} expired (no SMS in 20 min)",
                        "balance_after": new_bal,
                        "created_at":   now_ts,
                    })

                await db.otp_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "cancelled", "refunded": True}}
                )
                refunded_count += 1
                logger.info(f"✅ OTP auto-refunded: order={order_id} user={user_id} amount=${order['price_paid']}")

            except Exception as e:
                logger.error(f"❌ OTP auto-expiry failed for order {order.get('order_id')}: {e}")

        logger.info(f"✅ OTP expiry job: {refunded_count}/{len(expired)} orders refunded")
        return {"success": True, "refunded": refunded_count}

    except Exception as e:
        logger.error(f"❌ OTP expiry job error: {e}")
        return {"success": False, "error": str(e)}


def run_otp_expirations():
    """Synchronous wrapper for OTP auto-expiry job."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(process_otp_expirations())
        loop.close()
        return result
    except Exception as e:
        logger.error(f"Error in run_otp_expirations wrapper: {str(e)}")
        return {"success": False, "error": str(e)}


def run_orphaned_numbers_check():
    """Keep scheduler importable. Full Telnyx-vs-owners check runs if present."""
    try:
        from services.orphaned_numbers_watchdog import check_orphaned_numbers
        return check_orphaned_numbers()
    except ImportError:
        pass
    logger.warning("orphaned_numbers_check: watchdog module missing; skipping")
    return {"success": True, "skipped": True}
