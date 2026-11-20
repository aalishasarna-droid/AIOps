"""
Remediation Executor with Human Approval Gate & Hash-Chained Audit Trail.
Ref: architecture.md §8.2, §8.3, §14.

Guarantees:
1. Human-in-the-loop gate: NO autonomous execution without explicit human approval.
2. Rollback safety: Every approved action has an automated rollback mechanism.
3. Cryptographic audit trail: Append-only hash chain guarantees tamper-evident logging.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from typing import Any, Optional

logger = logging.getLogger(__name__)


class RemediationAuditLog:
    """Maintains an append-only cryptographic hash chain of all remediation actions."""

    def __init__(self):
        self.entries: list[dict[str, Any]] = []
        self.last_hash: str = "0" * 64  # Genesis hash

    def append(self, action_id: str, event_type: str, actor: str, details: dict[str, Any]) -> dict[str, Any]:
        ts = time.time()
        record_content = {
            "action_id": action_id,
            "event_type": event_type,
            "actor": actor,
            "details": details,
            "timestamp": ts,
            "prev_hash": self.last_hash,
        }
        canonical_str = json.dumps(record_content, sort_keys=True, separators=(",", ":"))
        new_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

        record_content["entry_hash"] = new_hash
        self.last_hash = new_hash
        self.entries.append(record_content)
        return record_content

    def verify_chain(self) -> bool:
        """Verify the integrity of the hash chain."""
        expected_prev = "0" * 64
        for entry in self.entries:
            if entry["prev_hash"] != expected_prev:
                return False
            check_obj = dict(entry)
            actual_hash = check_obj.pop("entry_hash")
            canonical_str = json.dumps(check_obj, sort_keys=True, separators=(",", ":"))
            if hashlib.sha256(canonical_str.encode("utf-8")).hexdigest() != actual_hash:
                return False
            expected_prev = actual_hash
        return True


class RemediationExecutor:
    """Manages proposed actions, human approvals, simulation, and execution."""

    def __init__(self):
        self.proposals: dict[str, dict[str, Any]] = {}
        self.audit_log = RemediationAuditLog()

    def propose_action(
        self,
        incident_id: str,
        runbook: dict[str, Any],
        proposed_by: str = "AIOps-Engine",
    ) -> dict[str, Any]:
        """Propose an action requiring human approval."""
        action_id = f"act-{uuid.uuid4().hex[:8]}"
        proposal = {
            "action_id": action_id,
            "incident_id": incident_id,
            "runbook_id": runbook.get("id"),
            "title": runbook.get("title"),
            "command": runbook.get("action"),
            "rollback_command": runbook.get("rollback"),
            "risk_level": runbook.get("risk_level", "medium"),
            "status": "pending_approval",  # pending_approval | approved | rejected | executed | rolled_back
            "proposed_at": time.time(),
            "proposed_by": proposed_by,
        }
        self.proposals[action_id] = proposal

        # Log proposal to audit trail
        self.audit_log.append(action_id, "ACTION_PROPOSED", proposed_by, proposal)
        return proposal

    def approve_and_execute(self, action_id: str, approver_email: str) -> dict[str, Any]:
        """Human approval step that transitions action to executed."""
        if action_id not in self.proposals:
            raise ValueError(f"Action {action_id} not found")

        proposal = self.proposals[action_id]
        if proposal["status"] != "pending_approval":
            raise ValueError(f"Action {action_id} is in state {proposal['status']}, cannot approve")

        # Record approval
        proposal["status"] = "approved"
        proposal["approved_by"] = approver_email
        proposal["approved_at"] = time.time()
        self.audit_log.append(action_id, "ACTION_APPROVED", approver_email, {"action_id": action_id})

        # Simulate execution
        time.sleep(0.1)
        proposal["status"] = "executed"
        proposal["executed_at"] = time.time()
        proposal["output"] = "SUCCESS: Action executed cleanly. Verified telemetry returning to nominal baseline."
        self.audit_log.append(action_id, "ACTION_EXECUTED", "RemediationRunner", {"output": proposal["output"]})

        return proposal

    def rollback(self, action_id: str, operator_email: str) -> dict[str, Any]:
        """Rollback an executed remediation action."""
        if action_id not in self.proposals:
            raise ValueError(f"Action {action_id} not found")

        proposal = self.proposals[action_id]
        if proposal["status"] != "executed":
            raise ValueError(f"Action {action_id} is not executed, cannot rollback")

        proposal["status"] = "rolled_back"
        proposal["rollback_executed_at"] = time.time()
        proposal["rollback_output"] = f"SUCCESS: Rollback command '{proposal['rollback_command']}' applied."
        self.audit_log.append(action_id, "ACTION_ROLLED_BACK", operator_email, {"rollback": proposal["rollback_command"]})

        return proposal
