const fs = require('fs');
const path = 'd:/smart money cash flow/smcf/sacco/src/lib/api.ts';
let c = fs.readFileSync(path, 'utf8');

if (!c.includes('registration_fee_paid: boolean;')) {
  c = c.replace(
    '  doc_kra_pin_certificate: string | null;\n  created_at: unknown;\n  updated_at: unknown;\n}',
    '  doc_kra_pin_certificate: string | null;\n  registration_fee_paid: boolean;\n  registration_fee_amount: number;\n  registration_fee_mpesa_code: string | null;\n  registration_fee_date: unknown;\n  registration_fee_phone: string | null;\n  registration_fee_transaction_id: string | null;\n  registration_fee_pending_checkout_id: string | null;\n  created_at: unknown;\n  updated_at: unknown;\n}'
  );
}

if (!c.includes('registration_fee_paid: Boolean(raw.registrationFeePaid')) {
  c = c.replace(
    '    doc_kra_pin_certificate: (raw.docKraPinCertificate ?? raw.doc_kra_pin_certificate ?? null) as string | null,\n    created_at: raw.createdAt ?? raw.created_at,\n    updated_at: raw.updatedAt ?? raw.updated_at,',
    '    doc_kra_pin_certificate: (raw.docKraPinCertificate ?? raw.doc_kra_pin_certificate ?? null) as string | null,\n    registration_fee_paid: Boolean(raw.registrationFeePaid ?? raw.registration_fee_paid ?? false),\n    registration_fee_amount: Number(raw.registrationFeeAmount ?? raw.registration_fee_amount ?? 100),\n    registration_fee_mpesa_code: (raw.registrationFeeMpesaCode ?? raw.registration_fee_mpesa_code ?? null) as string | null,\n    registration_fee_date: raw.registrationFeeDate ?? raw.registration_fee_date ?? null,\n    registration_fee_phone: (raw.registrationFeePhone ?? raw.registration_fee_phone ?? null) as string | null,\n    registration_fee_transaction_id: (raw.registrationFeeTransactionId ?? raw.registration_fee_transaction_id ?? null) as string | null,\n    registration_fee_pending_checkout_id: (raw.registrationFeePendingCheckoutId ?? raw.registration_fee_pending_checkout_id ?? null) as string | null,\n    created_at: raw.createdAt ?? raw.created_at,\n    updated_at: raw.updatedAt ?? raw.updated_at,'
  );
}

if (!c.includes('export interface RegistrationFeeStatus')) {
  const insertAfter = 'export const api = {';
  const idx = c.indexOf(insertAfter);
  const end = c.indexOf('};', idx);
  const before = c.slice(0, end + 3);
  const after = c.slice(end + 3);
  const extra = `\n\nexport interface RegistrationFeeStatus {\n  registrationFeePaid: boolean;\n  registrationFeeAmount: number;\n  registrationFeeMpesaCode: string | null;\n  registrationFeeDate: string | null;\n  registrationFeePhone: string | null;\n  registrationFeeTransactionId: string | null;\n  registrationFeePendingCheckoutId: string | null;\n}\n\nexport interface RegistrationFeeAdminMember {\n  id: string;\n  memberId: string;\n  name: string;\n  phone: string | null;\n  registrationFeePaid: boolean;\n  registrationFeeAmount: number;\n  registrationFeeMpesaCode: string | null;\n  registrationFeeDate: string | null;\n}\n\nexport interface RegistrationFeeAdminResponse {\n  members: RegistrationFeeAdminMember[];\n  summary: {\n    totalMembers: number;\n    paid: number;\n    pending: number;\n  };\n}\n\nexport async function getMyRegistrationFeeStatus(): Promise<RegistrationFeeStatus> {\n  const res = await api.get('/members/me/registration-fee-status');\n  return res as RegistrationFeeStatus;\n}\n\nexport async function initiateRegistrationFeePayment(payload: {\n  memberId: string;\n  phone?: string | null;\n}): Promise<{ checkoutRequestId: string }> {\n  const res = await api.post('/mpesa/registration-fee/initiate', payload);\n  const checkoutRequestId = (res as any)?.checkoutRequestId || (res as any)?.data?.checkoutRequestId;\n  return { checkoutRequestId: String(checkoutRequestId || '') };\n}\n\nexport async function getRegistrationFeeMembers(params?: { status?: 'all' | 'paid' | 'pending'; search?: string; }): Promise<RegistrationFeeAdminResponse> {\n  const query = new URLSearchParams();\n  if (params?.status && params.status !== 'all') query.set('status', params.status);\n  if (params?.search) query.set('search', params.search);\n  const q = query.toString();\n  const res = await api.get(`/members/registration-fee${q ? `?${q}` : ''}`);\n  return res as RegistrationFeeAdminResponse;\n}\n\nexport async function reconcileRegistrationFeeManual(payload: { phone: string; mpesaRef: string; amount: number; }): Promise<{ memberId: string; mpesaRef: string }> {\n  const res = await api.post('/mpesa/registration-fee/reconcile-manual', payload);\n  return res as { memberId: string; mpesaRef: string };\n}\n`;
  c = before + extra + after;
}

fs.writeFileSync(path, c, 'utf8');
console.log('patched api.ts');