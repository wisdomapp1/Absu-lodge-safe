# ABSU LodgeSafe Security Specification

## 1. Data Invariants
1. **Role Isolation**: Authenticated users can never escalate their own `role` field on `/profiles/{userId}` to `sug_admin`, `sug_president`, or `tech_manager`.
2. **PII Isolation**: Student email, phone, and matriculation number stored in `/profiles/{userId}` are readable only by the owning user or verified SUG admins (`isAdmin()`).
3. **Inspection Fee Integrity**: Every created `/properties/{propertyId}` and `/bookings/{bookingId}` document must enforce `inspectionFeeKobo == 300000` (₦3,000), immutable by agents.
4. **Verified Badge Integrity**: Only `isAdmin()` may transition a property's `verificationStatus` to `"SUG Verified"` or an agent's `status` to `"Approved"`.
5. **Booking Ownership & Terminal Lock**: A student can only read/create bookings where `studentUid == request.auth.uid`, cannot alter price fields after creation, and cannot modify a booking once it reaches `"Settled"` or `"Refunded"`.
6. **Audit Immutability**: `/audit_logs/{logId}` entries cannot be updated or deleted by any client.

## 2. Dirty Dozen Adversarial Payloads
1. Profile privilege escalation (`role: "sug_president"`) on self-create -> DENIED
2. Unverified email write (`email_verified: false`) -> DENIED
3. Shadow field injection (`isVerified: true`, `bypassEscrow: true`) on `/properties` -> DENIED
4. ID poisoning (`propertyId` > 128 chars or containing `/`) -> DENIED
5. Agent self-approving property (`verificationStatus: "SUG Verified"`) on create -> DENIED
6. Agent tampering with inspection fee (`inspectionFeeKobo: 0`) -> DENIED
7. Non-owner reading another student's `/profiles/{otherUid}` -> DENIED
8. Non-owner reading another student's `/bookings/{bookingId}` -> DENIED
9. Blanket `list` query on `/bookings` without `studentUid == auth.uid` -> DENIED
10. Modifying settled booking (`status: "Settled"` -> `"Refunded"`) -> DENIED
11. Student directly setting booking to `"Refund Approved"` -> DENIED
12. Deleting or mutating `/audit_logs/{logId}` -> DENIED
