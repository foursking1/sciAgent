"""
Session Events Cleanup Service

Provides automatic cleanup of old session_events records to prevent
unlimited table growth.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models.session_event import SessionEvent
from backend.db.database import get_db_session

logger = logging.getLogger(__name__)


# Default retention period for session events (30 days)
DEFAULT_RETENTION_DAYS = 30


class SessionEventsCleanup:
    """
    Handles cleanup of old session_events records.

    Features:
    - Configurable retention period (default: 30 days)
    - Batch deletion for performance
    - Statistics tracking
    """

    def __init__(self, retention_days: int = DEFAULT_RETENTION_DAYS):
        """
        Initialize the cleanup service.

        Args:
            retention_days: Number of days to retain events (default: 30)
        """
        self.retention_days = retention_days
        self.cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

    async def get_old_events_count(self, db: AsyncSession) -> int:
        """
        Get the count of events that would be deleted.

        Args:
            db: Database session

        Returns:
            Number of events older than retention period
        """
        result = await db.execute(
            select(func.count(SessionEvent.id)).where(
                SessionEvent.created_at < self.cutoff_date
            )
        )
        return result.scalar() or 0

    async def delete_old_events(
        self,
        db: AsyncSession,
        batch_size: int = 1000,
        dry_run: bool = False,
    ) -> dict:
        """
        Delete events older than the retention period.

        Args:
            db: Database session
            batch_size: Number of events to delete per batch (default: 1000)
            dry_run: If True, only report what would be deleted (default: False)

        Returns:
            Dictionary with cleanup statistics:
            - deleted_count: Number of events deleted
            - batches: Number of batches processed
            - retention_days: Configured retention period
            - cutoff_date: Date threshold for deletion
        """
        # Get count of events to delete
        old_count = await self.get_old_events_count(db)

        stats = {
            "deleted_count": 0,
            "batches": 0,
            "retention_days": self.retention_days,
            "cutoff_date": self.cutoff_date.isoformat(),
        }

        if old_count == 0:
            logger.info("No old events to clean up")
            return stats

        logger.info(
            f"Found {old_count} events older than {self.retention_days} days "
            f"(before {self.cutoff_date.isoformat()})"
        )

        if dry_run:
            logger.info("Dry run mode - no deletions performed")
            stats["would_delete"] = old_count
            return stats

        # Delete in batches to avoid long-running transactions
        deleted_total = 0
        batch_count = 0

        while True:
            # Delete one batch
            result = await db.execute(
                delete(SessionEvent)
                .where(SessionEvent.created_at < self.cutoff_date)
                .limit(batch_size)
            )

            batch_deleted = result.rowcount
            deleted_total += batch_deleted
            batch_count += 1

            # Commit each batch
            await db.commit()

            logger.info(
                f"Batch {batch_count}: Deleted {batch_deleted} events "
                f"(total: {deleted_total}/{old_count})"
            )

            # Stop if no more rows to delete
            if batch_deleted == 0 or batch_deleted < batch_size:
                break

        stats["deleted_count"] = deleted_total
        stats["batches"] = batch_count

        logger.info(
            f"Cleanup completed: Deleted {deleted_total} events in "
            f"{batch_count} batches"
        )

        return stats

    async def get_cleanup_stats(self, db: AsyncSession) -> dict:
        """
        Get statistics about session_events table.

        Args:
            db: Database session

        Returns:
            Dictionary with table statistics:
            - total_events: Total number of events
            - old_events: Number of events older than retention period
            - retention_days: Configured retention period
            - cutoff_date: Date threshold for deletion
        """
        # Total events
        total_result = await db.execute(select(func.count(SessionEvent.id)))
        total_events = total_result.scalar() or 0

        # Old events
        old_events = await self.get_old_events_count(db)

        return {
            "total_events": total_events,
            "old_events": old_events,
            "retention_days": self.retention_days,
            "cutoff_date": self.cutoff_date.isoformat(),
        }


async def run_session_events_cleanup(
    retention_days: int = DEFAULT_RETENTION_DAYS,
    dry_run: bool = False,
) -> dict:
    """
    Run the session events cleanup.

    This is the main entry point for cleanup operations.

    Args:
        retention_days: Number of days to retain events (default: 30)
        dry_run: If True, only report what would be deleted (default: False)

    Returns:
        Dictionary with cleanup statistics
    """
    cleanup = SessionEventsCleanup(retention_days=retention_days)

    async with get_db_session() as db:
        # Get stats before cleanup
        stats_before = await cleanup.get_cleanup_stats(db)

        logger.info(
            f"Session events cleanup starting (retention: {retention_days} days, "
            f"dry_run: {dry_run})"
        )
        logger.info(f"Stats before: {stats_before}")

        # Run cleanup
        result = await cleanup.delete_old_events(db, dry_run=dry_run)

        # Get stats after cleanup
        stats_after = await cleanup.get_cleanup_stats(db)
        logger.info(f"Stats after: {stats_after}")

        result["stats_before"] = stats_before
        result["stats_after"] = stats_after

        return result


# Global cleanup service instance
_cleanup_service: Optional[SessionEventsCleanup] = None


def get_cleanup_service(
    retention_days: int = DEFAULT_RETENTION_DAYS,
) -> SessionEventsCleanup:
    """
    Get the global cleanup service instance.

    Args:
        retention_days: Number of days to retain events

    Returns:
        SessionEventsCleanup instance
    """
    global _cleanup_service
    if _cleanup_service is None or _cleanup_service.retention_days != retention_days:
        _cleanup_service = SessionEventsCleanup(retention_days=retention_days)
    return _cleanup_service
