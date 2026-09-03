"""
Background job scheduler for Calliotel
Handles automated tasks for virtual number billing, renewals, expirations, and scheduled messages

Job imports are optional on purpose: a missing billing helper must never
prevent this module (or signup/login) from loading.
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)


def _load_job(module_name, attr):
    try:
        mod = __import__(module_name, fromlist=[attr])
        fn = getattr(mod, attr, None)
        if callable(fn):
            return fn
        logger.warning("Job %s.%s is missing; using no-op", module_name, attr)
    except Exception as e:
        logger.warning("Job %s.%s could not be imported (%s); using no-op", module_name, attr, e)

    def _skip(*_a, **_k):
        logger.warning("Skipping unavailable job %s.%s", module_name, attr)
        return {"success": True, "skipped": True, "job": attr}

    _skip.__name__ = attr
    return _skip


run_auto_renewals = _load_job("services.billing_jobs", "run_auto_renewals")
run_didww_renewals = _load_job("services.billing_jobs", "run_didww_renewals")
run_expirations = _load_job("services.billing_jobs", "run_expirations")
run_renewal_reminders = _load_job("services.billing_jobs", "run_renewal_reminders")
run_scheduled_messages = _load_job("services.billing_jobs", "run_scheduled_messages")
run_scheduled_video_messages = _load_job("services.billing_jobs", "run_scheduled_video_messages")
run_orphaned_numbers_check = _load_job("services.billing_jobs", "run_orphaned_numbers_check")
run_birthday_checks = _load_job("services.birthday_jobs", "run_birthday_checks")
run_winback_sync = _load_job("services.winback_email", "run_winback_sync")
run_telnyx_balance_check_sync = _load_job("services.telnyx_balance_alert", "run_telnyx_balance_check_sync")
run_esim_balance_check_sync = _load_job("services.esim_balance_alert", "run_esim_balance_check_sync")
run_drip_emails_sync = _load_job("services.drip_emails", "run_drip_emails_sync")
run_abandoned_followup_sync = _load_job("services.nowpayments_recovery", "run_abandoned_followup_sync")
run_reconciliation_sync = _load_job("services.nowpayments_recovery", "run_reconciliation_sync")
run_custody_sweep_sync = _load_job("services.nowpayments_recovery", "run_custody_sweep_sync")
run_stripe_watchdog_sync = _load_job("services.stripe_watchdog", "run_stripe_watchdog_sync")
run_callback_number_cleanup_sync = _load_job(
    "services.callback_number_cleanup_job", "run_callback_number_cleanup_sync"
)


async def run_weekly_challenge_winner():
    """Run weekly challenge winner selection"""
    try:
        from routes.daily_challenges import process_weekly_winner
        result = await process_weekly_winner()
        logger.info(f"✅ Weekly challenge winner processed: {result}")
        return result
    except Exception as e:
        logger.error(f"❌ Error processing weekly winner: {str(e)}")
        return {"success": False, "error": str(e)}

# Initialize scheduler
scheduler = BackgroundScheduler(timezone='UTC')


def setup_billing_jobs():
    """
    Register all billing-related background jobs
    """

    # Job 1: Auto-Renewals - Run daily at 2:00 AM UTC
    scheduler.add_job(
        run_auto_renewals,
        CronTrigger(hour=2, minute=0),
        id='auto_renewals',
        name='Process Virtual Number Auto-Renewals',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600
    )
    logger.info("✅ Scheduled: Auto-renewals job (daily at 2:00 AM UTC)")

    # Job 1b: Telnyx Number Renewals - Run daily at 2:15 AM UTC
    scheduler.add_job(
        run_didww_renewals,
        CronTrigger(hour=2, minute=15),
        id='telnyx_renewals',
        name='Process Telnyx Number Renewals (releases if not renewed)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600
    )
    logger.info("✅ Scheduled: Telnyx renewals job (daily at 2:15 AM UTC)")

    # Job 2: Expirations - Run daily at 3:00 AM UTC
    scheduler.add_job(
        run_expirations,
        CronTrigger(hour=3, minute=0),
        id='number_expirations',
        name='Process Number Expirations',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600
    )
    logger.info("✅ Scheduled: Expiration job (daily at 3:00 AM UTC)")

    # Job 3: Renewal Reminders - Run daily at 10:00 AM UTC
    scheduler.add_job(
        run_renewal_reminders,
        CronTrigger(hour=10, minute=0),
        id='renewal_reminders',
        name='Send Renewal Reminder Emails',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600
    )
    logger.info("✅ Scheduled: Renewal reminders job (daily at 10:00 AM UTC)")

    # Job 4: Scheduled Messages - Run every minute
    scheduler.add_job(
        run_scheduled_messages,
        IntervalTrigger(minutes=1),
        id='scheduled_messages',
        name='Send Scheduled Messages',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )
    logger.info("✅ Scheduled: Scheduled messages job (every 1 minute)")

    # Job 5: Scheduled Video Messages - Run every minute
    scheduler.add_job(
        run_scheduled_video_messages,
        IntervalTrigger(minutes=1),
        id='scheduled_video_messages',
        name='Send Scheduled Video Messages',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )
    logger.info("✅ Scheduled: Scheduled video messages job (every 1 minute)")

    # Job 6: Birthday Checks - Run daily at 1:00 AM UTC
    scheduler.add_job(
        run_birthday_checks,
        CronTrigger(hour=1, minute=0),
        id='birthday_checks',
        name='Check Birthdays and Send Notifications',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600
    )
    logger.info("✅ Scheduled: Birthday checks job (daily at 1:00 AM UTC)")

    # Job 7: Weekly Challenge Winner - Run every Sunday at 11:59 PM UTC
    scheduler.add_job(
        run_weekly_challenge_winner,
        CronTrigger(day_of_week='sun', hour=23, minute=59),
        id='weekly_challenge_winner',
        name='Select Weekly Challenge Winner',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600
    )
    logger.info("✅ Scheduled: Weekly challenge winner job (every Sunday at 11:59 PM UTC)")

    # Job 8: Telnyx low-balance watchdog — every hour
    scheduler.add_job(
        run_telnyx_balance_check_sync,
        IntervalTrigger(hours=1),
        id='telnyx_balance_check',
        name='Telnyx low-balance watchdog (alerts admins below $20)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600
    )
    logger.info("✅ Scheduled: Telnyx balance watchdog (every 1 hour, alert <$20)")

    # Job 9: eSIM Access low-balance watchdog — every hour
    scheduler.add_job(
        run_esim_balance_check_sync,
        IntervalTrigger(hours=1),
        id='esim_balance_check',
        name='eSIM Access low-balance watchdog (alerts admins below $20)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600
    )
    logger.info("✅ Scheduled: eSIM Access balance watchdog (every 1 hour, alert <$20)")

    # Job 10: Email queue drain — Run every 15 minutes
    try:
        from services.email_queue import drain_sync as _email_queue_drain_sync
        scheduler.add_job(
            _email_queue_drain_sync,
            IntervalTrigger(minutes=15),
            id='email_queue_drain',
            name='Drain Email Queue (welcome + transactional retries)',
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
            coalesce=True,
        )
        logger.info("✅ Scheduled: Email queue drain job (every 15 min)")
    except Exception as e:
        logger.warning("Email queue drain job not scheduled: %s", e)

    # Job 11: Drip emails — daily at 11:00 AM UTC (24h & 72h nudges for non-paying signups)
    scheduler.add_job(
        run_drip_emails_sync,
        CronTrigger(hour=11, minute=0),
        id='drip_emails',
        name='Drip emails for non-paying signups (24h & 72h)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600
    )
    logger.info("✅ Scheduled: Drip emails job (daily at 11:00 AM UTC)")

    # Job 12: Crypto abandoned payment follow-up — every 30 minutes
    scheduler.add_job(
        run_abandoned_followup_sync,
        IntervalTrigger(minutes=30),
        id='crypto_abandoned_followup',
        name='NOWPayments abandoned payment recovery emails (every 30 min)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600,
        coalesce=True,
    )
    logger.info("✅ Scheduled: Crypto abandoned followup (every 30 min)")

    # Job 13: NOWPayments daily reconciliation — 4:00 AM UTC
    scheduler.add_job(
        run_reconciliation_sync,
        CronTrigger(hour=4, minute=0),
        id='nowpayments_reconciliation',
        name='NOWPayments daily reconciliation (credits missed orders)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    logger.info("✅ Scheduled: NOWPayments reconciliation (daily at 4:00 AM UTC)")

    # Job 14: NOWPayments custody sweep — daily at 6:00 AM UTC
    scheduler.add_job(
        run_custody_sweep_sync,
        CronTrigger(hour=6, minute=0),
        id='nowpayments_custody_sweep',
        name='NOWPayments custody sweep (auto-withdraw to owner USDT wallet)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    logger.info("✅ Scheduled: NOWPayments custody sweep (daily at 6:00 AM UTC)")

    # Job 15: Stripe health watchdog — every 10 minutes
    # Alerts admins on Telegram the moment Stripe goes down or comes back up.
    scheduler.add_job(
        run_stripe_watchdog_sync,
        IntervalTrigger(minutes=10),
        id='stripe_watchdog',
        name='Stripe health watchdog (alerts on DOWN/UP transitions)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120,
        coalesce=True,
    )
    logger.info("✅ Scheduled: Stripe watchdog (every 10 min, alert on state change)")

    # Job 16: Nightly callback-number cleanup — 3:30 AM UTC
    # Clears any invalid bridge_phone / forward_to values and emails affected users.
    # Fires a Telegram admin alert only when records are cleared; silent when clean.
    scheduler.add_job(
        run_callback_number_cleanup_sync,
        CronTrigger(hour=3, minute=30),
        id='callback_number_cleanup',
        name='Nightly invalid callback-number cleanup',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    logger.info("✅ Scheduled: Callback-number cleanup (daily at 3:30 AM UTC)")

    # Job 17: eSIM top-up reconciliation — every 10 minutes
    try:
        from services.esim_reconcile_jobs import run_esim_topup_reconciliation_sync
        scheduler.add_job(
            run_esim_topup_reconciliation_sync,
            IntervalTrigger(minutes=10),
            id='esim_topup_reconciliation',
            name='eSIM top-up reconciliation (complete or refund stuck top-ups)',
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
            coalesce=True,
        )
        logger.info("✅ Scheduled: eSIM top-up reconciliation (every 10 min)")
    except Exception as e:
        logger.warning("eSIM top-up reconciliation job not scheduled: %s", e)

    # Job 18: Orphaned-number watchdog — daily at 2:45 AM UTC (after renewals)
    # Compares our Telnyx inventory against every collection that can own a
    # number; alerts admins about any number we pay for with no paying owner.
    scheduler.add_job(
        run_orphaned_numbers_check,
        CronTrigger(hour=2, minute=45),
        id='orphaned_numbers_watchdog',
        name='Orphaned Telnyx number watchdog (alerts on unowned numbers)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    logger.info("✅ Scheduled: Orphaned-number watchdog (daily at 2:45 AM UTC)")

    logger.info("✅ All billing jobs configured successfully")


def start_scheduler():
    try:
        setup_billing_jobs()
        scheduler.start()
        logger.info("🚀 Background job scheduler started successfully")
        logger.info(f"📅 Active jobs: {len(scheduler.get_jobs())}")
        for job in scheduler.get_jobs():
            logger.info(f"   - {job.name} (ID: {job.id}) - Next run: {job.next_run_time}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {str(e)}")
        return False


def stop_scheduler():
    try:
        scheduler.shutdown(wait=False)
        logger.info("⏹️ Background job scheduler stopped")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to stop scheduler: {str(e)}")
        return False


def get_job_status():
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time),
            "trigger": str(job.trigger)
        })
    return {
        "running": scheduler.running,
        "jobs": jobs,
        "total_jobs": len(jobs)
    }


def trigger_auto_renewals_now():
    logger.info("🔧 Manually triggering auto-renewals job...")
    return run_auto_renewals()


def trigger_expirations_now():
    logger.info("🔧 Manually triggering expirations job...")
    return run_expirations()


def trigger_reminders_now():
    logger.info("🔧 Manually triggering reminders job...")
    return run_renewal_reminders()


def trigger_scheduled_messages_now():
    logger.info("🔧 Manually triggering scheduled messages job...")
    return run_scheduled_messages()
