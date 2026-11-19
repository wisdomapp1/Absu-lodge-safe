export interface PolicyDocument {
  id: string;
  title: string;
  category: 'Legal & Compliance' | 'Operational Policy' | 'Governance & Handover';
  effectiveDate: string;
  approvalStatus: string;
  summary: string;
  clauses: string[];
}

export const POLICY_DOCUMENTS: PolicyDocument[] = [
  {
    id: 'terms',
    title: 'Terms and Conditions',
    category: 'Legal & Compliance',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Drafted for SUG Executive Council Ratification',
    summary:
      'Governs platform usage by ABSU students, verified accommodation agents, SUG administrators, and the Technical Manager.',
    clauses: [
      'ABSU LodgeSafe operates exclusively as an SUG-supervised accommodation marketplace for Abia State University, Uturu.',
      'No agent may list a property without valid identification, bank payout verification, and landlord authorization evidence.',
      'All monetary amounts shown on checkout (Yearly Rent, Agent Commission, and ₦3,000 Inspection Fee) are final. Agents are strictly prohibited from demanding unrecorded surcharges after payment.',
      'Live payment settlement remains disabled in Test Mode until written approval is obtained from an authorized payment partner supporting conditional settlement.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    category: 'Legal & Compliance',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Drafted for SUG Executive Council Ratification',
    summary:
      'Explains collection, protection, and access isolation of student matriculation records, agent KYC files, and landlord contact details.',
    clauses: [
      'Student matriculation numbers, phone numbers, and email addresses are isolated under role-based access rules and never exposed to public browsers or unverified agents.',
      'Private landlord phone numbers and exact house unit credentials are masked until a booking is initialized and confirmed.',
      'Audit logs and payment verification records are retained immutably for SUG accountability and dispute resolution.',
    ],
  },
  {
    id: 'student-agreement',
    title: 'Student Agreement',
    category: 'Legal & Compliance',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Active Standard',
    summary:
      'Defines student responsibilities during booking, physical inspection in Uturu, confirmation, and honest dispute filing.',
    clauses: [
      'Students must register with accurate ABSU matriculation number, faculty, department, and reachable phone contact.',
      'Students must physically inspect the property prior to clicking "Confirm Lodge & Release Funds".',
      'Submitting false refund claims after taking physical possession of keys constitutes a breach reportable to the SUG Disciplinary Committee.',
    ],
  },
  {
    id: 'agent-agreement',
    title: 'Agent Agreement',
    category: 'Legal & Compliance',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Active Standard',
    summary:
      'Binds accommodation agents to honest photography, accurate room counts, SUG commission limits, and physical inspection attendance.',
    clauses: [
      'Agents earn 45% of their declared agent commission (subject to SUG cap), while 55% goes to the platform (split 70% SUG / 30% Technical Manager). Agents earn 0% of landlord yearly rent.',
      'Agents must never modify paid booking prices, confirm bookings on behalf of students, or falsify room availability.',
      'Substantiated complaints or bait-and-switch inspections trigger immediate suspension and SUG investigation.',
    ],
  },
  {
    id: 'landlord-auth',
    title: 'Landlord Authorization Policy',
    category: 'Operational Policy',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Mandatory Pre-Listing Gate',
    summary:
      'Requires documented landlord consent before any lodge is verified or displayed with the SUG Verified badge.',
    clauses: [
      'Every lodge submission must identify the legal landlord/caretaker and attach signed landlord authorization evidence.',
      'SUG Accommodation Administrators verify landlord authorization before moving any lodge from Pending Verification to SUG Verified.',
    ],
  },
  {
    id: 'property-verification',
    title: 'Property Verification Policy',
    category: 'Operational Policy',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Mandatory Pre-Listing Gate',
    summary:
      'Standards for physical coordinates, media authenticity, room availability confirmations, and badge revocation.',
    clauses: [
      'Only listings approved by an authorized SUG Administrator may display the SUG Verified mark.',
      'Unverified or suspended properties are blocked from public verified collections and cannot accept bookings.',
    ],
  },
  {
    id: 'payment-policy',
    title: 'Payment Policy',
    category: 'Operational Policy',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Pending Payment Partner Written Approval',
    summary:
      'Defines upfront checkout structure, integer kobo accounting, and mandatory test-mode safeguards before live Paystack/partner activation.',
    clauses: [
      'Checkout totals equal: Yearly Rent + Agent Commission + ₦3,000 Automatic Inspection Fee.',
      'Ordinary merchant splitting is never represented as legally protected escrow. Live payments remain disabled until written confirmation of conditional settlement mechanics is received from the payment partner.',
    ],
  },
  {
    id: 'conditional-settlement',
    title: 'Conditional Settlement Policy',
    category: 'Operational Policy',
    effectiveDate: '2026-11-19',
    approvalStatus: 'SUG Ratification Required',
    summary:
      'Controls when landlord rent, agent earnings, SUG allocation, and Technical Manager allocation are released.',
    clauses: [
      'Funds remain in conditional hold status (`Awaiting Inspection`) until the student completes physical inspection and executes explicit confirmation.',
      'Each booking saves an immutable snapshot of the commission split percentages and kobo allocations active at checkout time.',
      'The ₦3,000 inspection fee is tracked in a separate operational ledger and never combined with agent or platform commission.',
    ],
  },
  {
    id: 'refund-policy',
    title: 'Refund Policy',
    category: 'Operational Policy',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Active Dispute Rule',
    summary:
      'Outlines qualifying refund triggers, evidence review, and full audit traceability back to the original payment reference.',
    clauses: [
      'Valid refund grounds include non-existent lodges, bait-and-switch properties, unverified landlord authorization, material photo/description mismatch, unauthorized rent hikes, or unavailable rooms.',
      'Approved refunds are decided exclusively by authorized SUG dispute administrators and executed through the payment partner API.',
    ],
  },
  {
    id: 'dispute-policy',
    title: 'Dispute Resolution Policy',
    category: 'Operational Policy',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Active Dispute Rule',
    summary:
      'Establishes timelines, escalation to the SUG President, and separation between technical operations and dispute adjudication.',
    clauses: [
      'Disputes enter `Dispute Requested` and transition to `Under SUG Review` upon submission.',
      'The Technical Manager cannot adjudicate disputes or alter financial records; serious escalations go to the SUG President.',
    ],
  },
  {
    id: 'handover-charter',
    title: 'SUG Ownership, Succession & Technical Management Charter',
    category: 'Governance & Handover',
    effectiveDate: '2026-11-19',
    approvalStatus: 'Executive Handover Instrument',
    summary:
      'Documents institutional ownership by the ABSU SUG President, succession handover protocol, domain/source-code governance, and Technical Manager compensation.',
    clauses: [
      'Institutional Ownership: The sitting ABSU SUG President is the authorized Project Owner on behalf of the Students’ Union Government.',
      'Administration Succession: Upon inauguration of a new SUG Executive Council, administrative ownership, SUG treasury settlement accounts, and audit logs transfer via formal handover certificate without disrupting live student bookings.',
      'Source Code & Domain Governance: Official domain (`absulodgesafe.ng` / university-approved subdomain) and repository custody are registered under institutional SUG governance with technical escrow backup.',
      'Technical Manager Mandate & Compensation: The appointed Technical Manager receives 30% of the platform’s 55% commission share (16.5% of gross agent commission) for infrastructure, security, backups, webhook maintenance, and SLA uptime, and holds no authority to approve their own payouts or alter financial ledgers.',
    ],
  },
];
