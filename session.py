from dataclasses import dataclass
from typing import Optional


@dataclass
class PatientData:
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    reason: Optional[str] = None
    doctor: Optional[str] = None
    date: Optional[str] = None
    slot: Optional[str] = None
    appointment_id: Optional[int] = None

_SHORT = {
    "name": "n", "age": "a", "gender": "g", "phone": "ph",
    "reason": "r", "doctor": "dr", "date": "dt", "slot": "sl",
    "appointment_id": "id"
}


class BookingSession:
    def __init__(self):
        self.flow: Optional[str] = None
        self.patient = PatientData()
        self.upcoming_shown: bool = False
        self.awaiting_confirmation: bool = False
        self.cancel_previewed: bool = False
        self._last_step: str = ""       
        self._last_snap_str: str = ""

    def reset(self):
        self.__init__()

    # ── BOOK: what to ask next ────────────────────────────────────
    def book_next_step(self) -> str:
        p = self.patient
        if not p.name and not p.age and not p.gender:
            return "ask_name_age_gender"
        if not p.name:
            return "ask_name"
        if not p.age and not p.gender:
            return "ask_age_gender"
        if not p.age:
            return "ask_age"
        if not p.gender:
            return "ask_gender"
        if not p.phone:
            return "ask_phone_then_fetch"
        if not p.reason and not p.date:
            return "ask_reason_and_date"
        if not p.reason:
            return "ask_reason"
        if not p.date:
            return "ask_date"
        if not p.slot:
            return "call_available_slots_then_ask_slot"
        if not self.awaiting_confirmation:
            return "call_show_confirmation"
        return "waiting_user_yes_to_book"

    # ── UPDATE flow ──────────────────────────────────────────────────────────
    def update_next_step(self) -> str:
        p = self.patient
        if not p.phone:
            return "ask_phone_then_fetch"
        if not self.upcoming_shown:
            return "call_fetch_upcoming"
        if not p.appointment_id:
            return "ask_which_appointment_to_update"
        if not self.awaiting_confirmation:
            return "ask_what_to_change_then_show_confirmation"
        return "waiting_user_yes_to_update"

    # ── CANCEL flow ──────────────────────────────────────────────────────────
    def cancel_next_step(self) -> str:
        p = self.patient
        if not p.phone:
            return "ask_phone_then_fetch"
        if not self.upcoming_shown:
            return "call_fetch_upcoming"
        if not p.appointment_id:
            return "ask_which_appointment_to_cancel"
        if not self.cancel_previewed:
            return "call_cancel_confirmed_false"
        return "waiting_user_yes_to_cancel"

    # ── Router ───────────────────────────────────────────────────────────────
    def next_step(self) -> str:
        if self.flow == "book":
            return self.book_next_step()
        elif self.flow == "update":
            return self.update_next_step()
        elif self.flow == "cancel":
            return self.cancel_next_step()
        return "ask_intent"

    # ── State snapshot ───────────────────────────────────────────
    def state_snapshot(self) -> dict:

        ask = self.next_step()
        snap: dict = {"f": self.flow or "?", "a": ask}
        flags = {}
        if self.upcoming_shown:
            flags["up"] = 1
        if self.awaiting_confirmation:
            flags["cf"] = 1
        if self.cancel_previewed:
            flags["pv"] = 1
        if flags:
            snap["fl"] = flags
        p = self.patient
        if p.phone:
            snap["ph"] = p.phone
        if p.appointment_id:
            snap["id"] = p.appointment_id

        return snap

    def state_snapshot_if_changed(self) -> Optional[dict]:
        import json
        snap = self.state_snapshot()
        snap_str = json.dumps(snap, separators=(',', ':'))
        if snap_str == self._last_snap_str:
            return None  
        self._last_snap_str = snap_str
        return snap

    def to_known_dict(self) -> dict:
        return {k: v for k, v in self.patient.__dict__.items() if v is not None}
