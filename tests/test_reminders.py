"""Phone reminders: when they fire, who may aim them where, and how a change restarts them."""

from __future__ import annotations

from datetime import datetime, time, timedelta

import pytest

from conftest import TZ, plan_by_name

from taskdragon import reminders as r
from taskdragon.planner import Actor, PlannerError

ALEX = Actor(user_id="u-alex", user_name="Alex", person="person.alex", is_admin=True)
SAM = Actor(user_id="u-sam", user_name="Sam", person="person.sam")


def local(*args: int) -> datetime:
    return datetime(*args, tzinfo=TZ)


def test_targets_and_times_are_validated() -> None:
    assert r.clean_target("") is None and r.clean_target(None) is None
    assert r.clean_target("assigned") == "assigned"
    assert r.clean_target(" notify.mobile_app_pixel_8 ") == "notify.mobile_app_pixel_8"
    for bad in ("light.turn_on", "notify.", "notify.Bad-Name", "script.x", "notify.a;b"):
        with pytest.raises(ValueError):
            r.clean_target(bad)
    assert r.clean_time("7:05") == "07:05" and r.clean_time("14:30:00") == "14:30" and r.clean_time("") is None
    for bad in ("24:00", "12:60", "noon", "1430"):
        with pytest.raises(ValueError):
            r.clean_time(bad)


def test_when_a_reminder_goes_out() -> None:
    base = {"remind_target": "assigned", "due_date": "2026-10-27", "time_of_day_bucket": "anytime"}
    assert r.reminder_moment(base, TZ) == local(2026, 10, 27, 9, 0)
    assert r.reminder_clock({**base, "time_of_day_bucket": "evening"}, TZ) == time(18)
    assert r.reminder_clock({**base, "remind_time": "06:45"}, TZ) == time(6, 45)
    due_at = {**base, "due_datetime": local(2026, 10, 27, 14, 30).isoformat()}
    assert r.reminder_clock(due_at, TZ) == time(14, 30)
    assert r.reminder_clock({**due_at, "remind_time": "13:00"}, TZ) == time(13), "an explicit time wins over the due time"
    assert r.reminder_moment({"remind_target": "assigned"}, TZ) is None

    assert r.reminder_state(base, local(2026, 10, 27, 8, 59), TZ) == r.WAIT
    assert r.reminder_state(base, local(2026, 10, 27, 9, 0), TZ) == r.SEND
    assert r.reminder_state(base, local(2026, 10, 27, 15, 1), TZ) == r.STALE
    assert r.reminder_state({**base, "reminded_for": "2026-10-27"}, local(2026, 10, 27, 9, 5), TZ) == r.NONE
    assert r.reminder_state({**base, "reminded_for": "2026-10-26"}, local(2026, 10, 27, 9, 5), TZ) == r.SEND, "a new occurrence"
    assert r.reminder_state({**base, "remind_target": None}, local(2026, 10, 27, 9, 5), TZ) == r.NONE


def test_message_and_buttons() -> None:
    task = {"summary": "Make shakes", "due_date": "2026-10-27", "due_datetime": local(2026, 10, 27, 7, 30).isoformat(), "recurrence_label": "Weekly on Sat"}
    title, message = r.reminder_text(task, "Daily Chores", TZ)
    assert title == "Make shakes" and message == "Due at 07:30 · Weekly on Sat · Daily Chores"
    data = r.notification_data("abc123", "/taskdragon?task=abc123")
    assert [a["action"] for a in data["actions"]] == ["TASKDRAGON_DONE_abc123", "TASKDRAGON_SNOOZE_abc123"]
    assert data["tag"] == "taskdragon-task-abc123" and data["clickAction"] == "/taskdragon?task=abc123"
    assert r.parse_action("TASKDRAGON_DONE_abc123") == ("done", "abc123")
    assert r.parse_action("TASKDRAGON_SNOOZE_abc123") == ("snooze", "abc123")
    for other in ("TASKDRAGON_DONE_", "TASKDRAGON_DONE_a b", "SOMETHING_ELSE", None, "TASKDRAGON_DONE_" + "x" * 65):
        assert r.parse_action(other) is None


async def test_reminders_are_sent_once_per_occurrence(planner, clock) -> None:
    chores = await plan_by_name(planner, "Daily Chores")
    task = await planner.save_task(
        {"plan_id": chores["id"], "summary": "Make shakes", "due_date": "2026-10-27", "remind_target": "assigned", "remind_time": "18:00", "recurrence_mode": "calendar", "recurrence_rule": "FREQ=DAILY"},
        ALEX,
    )
    assert task["remind_target"] == "assigned" and task["remind_time"] == "18:00" and task["reminded_for"] is None
    assert await planner.due_reminders() == []
    clock.set_local(2026, 10, 27, 18, 0)
    due = await planner.due_reminders()
    assert [t["uid"] for t in due] == [task["uid"]] and due[0]["recurrence_label"]
    await planner.mark_reminded(task["uid"], due[0]["due_date"])
    assert await planner.due_reminders() == []
    # Done today, rolled over to tomorrow: tomorrow's occurrence is reminded again.
    await planner.set_completed(task["uid"], True, ALEX)
    clock.set_local(2026, 10, 28, 18, 1)
    await planner.process_rollover()
    assert [t["uid"] for t in await planner.due_reminders()] == [task["uid"]]
    board = await planner.get_board(actor=ALEX)
    row = next(t for t in board["tasks"] if t["uid"] == task["uid"])
    assert "reminded_for" not in row and row["remind_time"] == "18:00"


async def test_late_and_finished_tasks_send_nothing(planner, clock) -> None:
    chores = await plan_by_name(planner, "Daily Chores")
    late = await planner.save_task({"plan_id": chores["id"], "summary": "Old", "due_date": "2026-10-27", "remind_target": "assigned", "remind_time": "10:00"}, ALEX)
    done = await planner.save_task({"plan_id": chores["id"], "summary": "Done", "due_date": "2026-10-27", "remind_target": "assigned", "remind_time": "10:00"}, ALEX)
    await planner.set_completed(done["uid"], True, ALEX)
    snoozed = await planner.save_task({"plan_id": chores["id"], "summary": "Later", "due_date": "2026-10-27", "remind_target": "assigned", "remind_time": "10:00"}, ALEX)
    await planner.snooze_until(snoozed["uid"], local(2026, 10, 28, 9, 0), ALEX)
    clock.set_local(2026, 10, 27, 17, 0)  # seven hours late: Home Assistant was off
    assert await planner.due_reminders() == []
    assert (await planner.db.get_task(late["uid"]))["reminded_for"] == "2026-10-27", "dropped, not sent hours late"
    assert (await planner.db.get_task(snoozed["uid"]))["reminded_for"] is None


async def test_a_reminder_set_after_its_time_waits_for_the_next_occurrence(planner, clock) -> None:
    chores = await plan_by_name(planner, "Daily Chores")
    clock.set_local(2026, 10, 27, 12, 0)
    task = await planner.save_task({"plan_id": chores["id"], "summary": "Water plants", "due_date": "2026-10-27", "remind_target": "assigned", "remind_time": "08:00"}, ALEX)
    assert task["reminded_for"] == "2026-10-27", "08:00 already went by today"
    assert await planner.due_reminders() == []
    # Moving it to a later time today restarts it.
    moved = await planner.save_task({"uid": task["uid"], "remind_time": "12:30"}, ALEX)
    assert moved["reminded_for"] is None
    clock.set_local(2026, 10, 27, 12, 30)
    assert [t["uid"] for t in await planner.due_reminders()] == [task["uid"]]
    # Saving the task unchanged (the card resends every field) doesn't restart a sent reminder.
    await planner.mark_reminded(task["uid"], "2026-10-27")
    again = await planner.save_task({"uid": task["uid"], "summary": "Water plants", "remind_target": "assigned", "remind_time": "12:30", "due_date": "2026-10-27"}, ALEX)
    assert again["reminded_for"] == "2026-10-27"


async def test_who_may_aim_a_reminder_where(planner) -> None:
    chores = await plan_by_name(planner, "Daily Chores")
    phones = {"notify.mobile_app_pixel"}

    def allowed(target: str, actor: Actor) -> bool:
        return target == "assigned" or target in phones or (target == "notify.telegram" and actor.is_admin)

    planner.reminder_allowed = allowed
    task = await planner.save_task({"plan_id": chores["id"], "summary": "Trash", "remind_target": "notify.mobile_app_pixel"}, SAM)
    with pytest.raises(PlannerError) as err:
        await planner.save_task({"uid": task["uid"], "remind_target": "notify.telegram"}, SAM)
    assert err.value.code == "invalid"
    assert (await planner.save_task({"uid": task["uid"], "remind_target": "notify.telegram"}, ALEX))["remind_target"] == "notify.telegram"
    # The phone was removed later: the task still saves as long as the target isn't changed.
    phones.clear()
    assert (await planner.save_task({"uid": task["uid"], "summary": "Take out trash", "remind_target": "notify.telegram"}, SAM))["summary"] == "Take out trash"
    with pytest.raises(PlannerError):
        await planner.save_task({"plan_id": chores["id"], "summary": "x", "remind_target": "light.turn_on"}, ALEX)
    with pytest.raises(PlannerError):
        await planner.save_task({"plan_id": chores["id"], "summary": "x", "remind_target": "assigned", "remind_time": "25:00"}, ALEX)
    cleared = await planner.save_task({"uid": task["uid"], "remind_target": None, "remind_time": None}, SAM)
    assert cleared["remind_target"] is None and cleared["remind_time"] is None


def test_stale_window_is_hours_not_days() -> None:
    assert timedelta(hours=1) < r.STALE_AFTER <= timedelta(hours=12)
