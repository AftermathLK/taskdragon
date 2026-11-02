"""Phone reminders for tasks (no Home Assistant imports, so it can be unit tested).

A task with ``remind_target`` set is announced once per occurrence, on its due
date: at ``remind_time`` if one is set, otherwise at the task's due time, or
otherwise at a time that suits its time-of-day bucket (morning 08:00,
afternoon 13:00, evening 18:00, anytime 09:00). ``reminded_for`` records the
due date that was announced, so a repeating task is announced again once it
rolls over to its next date.

Targets are ``assigned`` (the phones of whoever the task is assigned to, or of
the whole household when nobody is) or a single ``notify.*`` service. The
notification carries two buttons, Done and Snooze; the Home Assistant
companion app reports a tap as a ``mobile_app_notification_action`` event
whose action is one of :data:`ACTION_DONE` / :data:`ACTION_SNOOZE` followed by
the task uid.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import datetime, time, timedelta, tzinfo
from typing import Any

from .const import BUCKET_ANYTIME
from .timeutil import parse_date, parse_datetime

REMIND_ASSIGNED = "assigned"
REMIND_TARGET_RE = re.compile(r"^notify\.[a-z0-9_]{1,120}$")
_CLOCK_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*$")
_UID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
# A reminder Home Assistant couldn't send on time (it was off, the task was snoozed
# past it) is dropped once it's this late rather than arriving hours afterwards.
STALE_AFTER = timedelta(hours=6)
BUCKET_TIMES = {"morning": time(8), "afternoon": time(13), "evening": time(18), BUCKET_ANYTIME: time(9)}
ACTION_DONE = "TASKDRAGON_DONE_"
ACTION_SNOOZE = "TASKDRAGON_SNOOZE_"
SNOOZE_MINUTES = 60

WAIT = "wait"  # not yet time
SEND = "send"  # time to send
STALE = "stale"  # too late to be useful; mark it handled without sending
NONE = "none"  # nothing to send (no target, no due date)


def clean_target(value: Any) -> str | None:
    """``assigned``, a ``notify.*`` service, or ``None``; anything else raises ``ValueError``."""
    text = str(value or "").strip()
    if not text:
        return None
    if text == REMIND_ASSIGNED or REMIND_TARGET_RE.match(text):
        return text
    raise ValueError("Reminders go to a phone, like notify.mobile_app_pixel")


def clean_time(value: Any) -> str | None:
    """``HH:MM`` (24-hour) or ``None``; anything else raises ``ValueError``."""
    text = str(value or "").strip()
    if not text:
        return None
    match = _CLOCK_RE.match(text)
    if match is None or int(match.group(1)) > 23 or int(match.group(2)) > 59:
        raise ValueError("Times look like 14:30")
    return f"{int(match.group(1)):02d}:{match.group(2)}"


def reminder_clock(task: Mapping[str, Any], tz: tzinfo) -> time:
    """The time of day the reminder goes out on the due date."""
    if task.get("remind_time"):
        try:
            hour, minute = (int(part) for part in str(clean_time(task["remind_time"])).split(":"))
            return time(hour, minute)
        except (ValueError, TypeError):
            pass
    due = parse_date(task.get("due_date"))
    moment = parse_datetime(task.get("due_datetime"), tz)
    if moment is not None and due is not None:
        local = moment.astimezone(tz)
        if local.date() == due:
            return local.time().replace(second=0, microsecond=0)
    return BUCKET_TIMES.get(task.get("time_of_day_bucket") or BUCKET_ANYTIME, BUCKET_TIMES[BUCKET_ANYTIME])


def reminder_moment(task: Mapping[str, Any], tz: tzinfo) -> datetime | None:
    """When the reminder for the task's current occurrence is due, or ``None`` without a due date."""
    due = parse_date(task.get("due_date"))
    if due is None:
        return None
    return datetime.combine(due, reminder_clock(task, tz), tzinfo=tz)


def reminder_state(task: Mapping[str, Any], now: datetime, tz: tzinfo) -> str:
    """What to do about a task's reminder right now: :data:`WAIT`, :data:`SEND`, :data:`STALE` or :data:`NONE`."""
    if not task.get("remind_target") or task.get("reminded_for") == task.get("due_date"):
        return NONE
    moment = reminder_moment(task, tz)
    if moment is None:
        return NONE
    if now < moment:
        return WAIT
    return STALE if now - moment > STALE_AFTER else SEND


def already_past(task: Mapping[str, Any], now: datetime, tz: tzinfo) -> bool:
    """Whether the current occurrence's reminder time has gone by (a new or changed reminder skips it)."""
    moment = reminder_moment(task, tz)
    return moment is not None and moment <= now


def reminder_text(task: Mapping[str, Any], plan_name: str | None, tz: tzinfo) -> tuple[str, str]:
    """The notification's title and message."""
    title = str(task.get("summary") or "Task")[:120]
    when = "Due today"
    moment = parse_datetime(task.get("due_datetime"), tz)
    due = parse_date(task.get("due_date"))
    if moment is not None and due is not None and moment.astimezone(tz).date() == due:
        when = f"Due at {moment.astimezone(tz).strftime('%H:%M')}"
    parts = [when]
    if task.get("recurrence_label"):
        parts.append(str(task["recurrence_label"]))
    if plan_name:
        parts.append(str(plan_name))
    return title, " · ".join(parts)


def notification_data(uid: str, link: str) -> dict[str, Any]:
    """Companion-app extras: tap to open TaskDragon, replace an older reminder for the same task, two buttons."""
    return {
        "tag": f"taskdragon-task-{uid}",
        "group": "taskdragon",
        "url": link,
        "clickAction": link,
        "actions": [
            {"action": f"{ACTION_DONE}{uid}", "title": "Done"},
            {"action": f"{ACTION_SNOOZE}{uid}", "title": f"Snooze {SNOOZE_MINUTES} min"},
        ],
    }


def parse_action(action: Any) -> tuple[str, str] | None:
    """``("done" | "snooze", uid)`` for one of our notification buttons, else ``None``."""
    text = str(action or "")
    for prefix, kind in ((ACTION_DONE, "done"), (ACTION_SNOOZE, "snooze")):
        if text.startswith(prefix):
            uid = text[len(prefix):]
            return (kind, uid) if _UID_RE.match(uid) else None
    return None
