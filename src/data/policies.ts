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
    effectiveDate: '2026-11-25',
    approvalStatus: 'SUG & Super Admin Active Policy',
    summary:
      'Governs platform usage by ABSU students, verified accommodation agents, SUG Administrators, and the Super Admin.',
    clauses: [
      'ABSU Lodge operates exclusively as an SUG-supervised accommodation marketplace for Abia State University, Uturu.',
      'Rent is NEVER paid on this platform. Platform checkout collects ONLY the Agent Fee plus the fixed ₦3,000 Inspection Fee.',
      'No agent may list a property without NIN verification, verified payout details, landlord details, and caretaker contact details.',
      'Rent is paid DIRECT to the landlord or caretaker after physical inspection, with a receipt. The agent must never collect rent.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    category: 'Legal & Compliance',
    effectiveDate: '2026-11-25',
    approvalStatus: 'Active Standard',
    summary:
      'Explains collection, protection, and access isolation of student records, agent NIN documents, and landlord/caretaker contact details.',
    clauses: [
      'Student phone numbers, WhatsApp numbers, and matriculation records are protected by Supabase RLS and never exposed publicly.',
      'Agent NIN numbers and verification documents are restricted strictly to the agent and Super Admin.',
      'Landlord and caretaker phone numbers are hidden from public view prior to verified booking.',
    ],
  },
  {
    id: 'student-agreement',
    title: 'Student Booking & Refund Agreement',
    category: 'Legal & Compliance',
    effectiveDate: '2026-11-25',
    approvalStatus: 'Mandatory Pre-Payment Agreement',
    summary:
      'Defines student responsibilities during booking, physical inspection in Uturu, confirmation, and honest refund claims.',
    clauses: [
      'Pay ONLY Agent Fee plus Inspection Fee here first. Do NOT pay rent on this website. Do NOT pay any other fee to agent.',
      'When you go for inspection: Ask for lodge receipt BEFORE you pay rent. Make sure landlord or caretaker is aware before you pay rent.',
      'If agent tries to scam you, click REFUND in your dashboard. You will get your Agent Fee plus Inspection Fee back.',
      'Confirming a lodge unlocks after the scheduled inspection date/time has begun. If no refund is requested within the 48-hour hold window after payment, settlement is processed automatically.',
    ],
  },
  {
    id: 'agent-agreement',
    title: 'Agent Agreement & Revenue Split',
    category: 'Legal & Compliance',
    effectiveDate: '2026-11-25',
    approvalStatus: 'Active Standard',
    summary:
      'Binds accommodation agents to honest photography, approved fee tiers, caretaker transparency, and physical inspection attendance.',
    clauses: [
      'Agents select an approved Agent Fee tier (₦5,000, ₦10,000, ₦15,000, ₦20,000, ₦30,000, or ₦40,000). The fixed ₦3,000 Inspection Fee goes 100% to Platform Backend Management.',
      'Agent Fee distribution: 40% to Agent, 35% to SUG, and 25% to Platform Backend Management. Example: On ₦20,000 Agent Fee + ₦3,000 Inspection Fee (₦23,000 total), Agent earns ₦8,000, SUG earns ₦7,000, and Platform receives ₦8,000 (₦5,000 + ₦3,000).',
      'Funds remain in a 48-hour payment hold after student payment. Agents cannot withdraw pending held funds before inspection confirmation or 48-hour release.',
      'Agents must never include external payment links or rent-collection instructions in lodge descriptions, and must never collect rent from students.',
    ],
  },
  {
    id: 'conditional-settlement',
    title: '48-Hour Payment Hold & Conditional Settlement Policy',
    category: 'Operational Policy',
    effectiveDate: '2026-11-25',
    approvalStatus: 'Active Automated Workflow',
    summary:
      'Controls how Paystack payments are held for 48 hours and transferred across Agent, SUG, and Platform accounts.',
    clauses: [
      'Upon Paystack verification, booking payment enters `held` status (`split_at = paid_at + 48 hours`).',
      'If the student clicks REFUND before 48 hours elapse, settlement is immediately locked (`refund_pending`) and routed for refund processing.',
      'If confirmed after inspection or after the 48-hour hold with no dispute, scheduled Edge Functions execute Paystack transfers and confirm delivery via webhooks with up to 3 automatic retries.',
      'Refunded transactions yield ₦0 to the Agent, ₦0 to SUG, and ₦0 to the Platform.',
    ],
  },
  {
    id: 'handover-charter',
    title: 'SUG Ownership, Succession & Super Admin Governance',
    category: 'Governance & Handover',
    effectiveDate: '2026-11-25',
    approvalStatus: 'Institutional Governance Instrument',
    summary:
      'Separates SUG accommodation oversight from Super Admin infrastructure, Paystack keys, bank transfers, and refund execution.',
    clauses: [
      'SUG Administrators approve or reject pending lodges (with mandatory rejection reason), monitor bookings, view SUG earnings, and review complaints.',
      'SUG Administrators do NOT have access to Paystack secrets, manual refund execution, bank transfer initiation, or agent banning/user deletion.',
      'The Super Admin oversees agent verification/suspension/banning, SUG Admin account creation, fraudulent listing removal, 48-hour settlement execution/retries, Paystack refund execution, and system backups.',
    ],
  },
];
