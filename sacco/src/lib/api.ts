/**
 * Central API client for the SMCF SACCO backend (MongoDB/Express on Render).
 * Reads VITE_SACCO_API_URL first, then falls back to VITE_API_URL.
 */

const BASE =
  (import.meta.env.VITE_SACCO_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  "http://localhost:5000/api";
const TOKEN_KEY = "smcf_auth_token";

export function getApiBaseForDebug(): string {
  return BASE;
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

interface ApiResponse<T> {
  data?: T;
  message?: string;
}

interface DbDocument {
  _id?: string | object;
  id?: string;
  [key: string]: unknown;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Token expired / invalid – clear session and redirect to login
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("smcf_auth_user");
    if (window.location.pathname !== "/sacco/auth") {
      window.location.href = "/sacco/auth";
    }
    throw new Error("Unauthorized");
  }
  const json = await res.json().catch(() => ({})) as ApiResponse<T>;
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return (json.data ?? json) as T;
}

export const api = {
  get<T = unknown>(path: string): Promise<T> {
    return fetch(`${BASE}${path}`, { headers: authHeaders() }).then((r) => handle<T>(r));
  },
  post<T = unknown>(path: string, body: unknown): Promise<T> {
    return fetch(`${BASE}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r));
  },
  put<T = unknown>(path: string, body: unknown = {}): Promise<T> {
    return fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r));
  },
  patch<T = unknown>(path: string, body: unknown = {}): Promise<T> {
    return fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r));
  },
  del<T = unknown>(path: string): Promise<T> {
    return fetch(`${BASE}${path}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => handle<T>(r));
  },
};

// ─── Data normalisers (MongoDB camelCase → UI snake_case) ─────────────────────

/** MongoDB doc helper: turns _id to id */
function base(doc: DbDocument): DbDocument {
  if (!doc) return doc;
  const d = { ...doc };
  if (d._id && !d.id) d.id = String(d._id);
  return d;
}

export function normalizeMember(m: DbDocument) {
  if (!m) return m;
  m = base(m);
  const linkedUser = (m.userId && typeof m.userId === "object" ? m.userId : null) as any;
  return {
    ...m,
    id: m.id || String(m._id),
    member_id: m.memberId ?? m.member_id,
    user_id: linkedUser ? String(linkedUser._id ?? linkedUser.id ?? "") : (m.userId ? String(m.userId) : (m.user_id ?? null)),
    email: linkedUser?.email ?? m.email ?? null,
    loan_balance: m.loanBalance ?? m.loan_balance ?? 0,
    risk_score: m.riskScore ?? m.risk_score ?? null,
    join_date: m.joinDate ?? m.join_date,
    kyc_verified: m.kycVerified ?? m.kyc_verified ?? false,
    kyc_verified_at: m.kycVerifiedAt ?? m.kyc_verified_at ?? null,
    profile_photo: m.profilePhoto ?? m.profile_photo ?? null,
    // Extended profile
    national_id: m.nationalId ?? m.national_id ?? null,
    date_of_birth: m.dateOfBirth ?? m.date_of_birth ?? null,
    gender: m.gender ?? null,
    county: m.county ?? null,
    occupation: m.occupation ?? null,
    employer: m.employer ?? null,
    // KYC documents
    doc_id_copy: m.docIdCopy ?? m.doc_id_copy ?? null,
    doc_passport_photo: m.docPassportPhoto ?? m.doc_passport_photo ?? null,
    doc_membership_form: m.docMembershipForm ?? m.doc_membership_form ?? null,
    doc_kra_pin_certificate: m.docKraPinCertificate ?? m.doc_kra_pin_certificate ?? null,
    created_at: m.createdAt ?? m.created_at,
    updated_at: m.updatedAt ?? m.updated_at,
  };
}

export function normalizeLoan(l: DbDocument) {
  if (!l) return l;
  l = base(l);
  // Populated memberId may be an object
  const memberObj = (l.memberId && typeof l.memberId === "object" ? l.memberId : null) as any;
  return {
    ...l,
    id: l.id || String(l._id),
    loan_number: l.loanNumber ?? l.loan_number,
    member_id: memberObj ? String(memberObj._id || memberObj.id) : (l.memberId ? String(l.memberId) : l.member_id),
    interest_rate: l.interestRate ?? l.interest_rate,
    term_months: l.termMonths ?? l.term_months,
    monthly_installment: l.monthlyInstallment ?? l.monthly_installment,
    total_payable: l.totalPayable ?? l.total_payable,
    risk_rating: l.riskRating ?? l.risk_rating ?? null,
    applied_at: l.appliedAt ?? l.applied_at,
    approved_at: l.approvedAt ?? l.approved_at ?? null,
    approved_by: l.approvedBy ? String(l.approvedBy) : (l.approved_by ?? null),
    applied_by: l.appliedBy ? String(l.appliedBy) : (l.applied_by ?? null),
    disbursed_date: l.disbursedDate ?? l.disbursed_date ?? null,
    rejection_reason: l.rejectionReason ?? l.rejection_reason ?? null,
    interest_model: l.interestModel ?? l.interest_model ?? "reducing",
    created_at: l.createdAt ?? l.created_at,
    updated_at: l.updatedAt ?? l.updated_at,
    // Populated member object for joins
    members: memberObj
      ? { name: memberObj.name, member_id: memberObj.memberId ?? memberObj.member_id }
      : (l.members ?? null),
    // Guarantors array if returned
    loan_guarantors: ((l.guarantors ?? l.loan_guarantors ?? []) as any[]).map((g: any) => {
      const gm = (g.memberId && typeof g.memberId === "object" ? g.memberId : null) as any;
      return {
        ...base(g),
        member_id: gm ? String(gm._id || gm.id) : (g.memberId ? String(g.memberId) : g.member_id),
        guarantee_amount: g.guaranteeAmount ?? g.guarantee_amount ?? 0,
        consent_status: g.consentStatus ?? g.consent_status ?? 'pending',
        response_note: g.responseNote ?? g.response_note ?? null,
        responded_at: g.respondedAt ?? g.responded_at ?? null,
        members: gm ? { name: gm.name, savings: gm.savings } : (g.members ?? null),
      };
    }),
    // Approvals array if returned
    loan_approvals: ((l.approvals ?? l.loan_approvals ?? []) as any[]).map((a: any) => ({
      ...base(a),
      loan_id: a.loanId ? String(a.loanId) : (a.loan_id ?? null),
      approver_id: a.approverId ? String(a.approverId) : (a.approver_id ?? null),
      approval_level: a.approvalLevel ?? a.approval_level,
      approved_at: a.approvedAt ?? a.approved_at,
      created_at: a.createdAt ?? a.created_at,
    })),
  };
}

export function normalizeTransaction(t: DbDocument) {
  if (!t) return t;
  t = base(t);
  const memberObj = (t.memberId && typeof t.memberId === "object" ? t.memberId : null) as any;
  return {
    ...t,
    id: t.id || String(t._id),
    transaction_ref: t.transactionRef ?? t.transaction_ref,
    member_id: memberObj ? String(memberObj._id || memberObj.id) : (t.memberId ? String(t.memberId) : t.member_id),
    processed_at: t.processedAt ?? t.processed_at ?? t.createdAt,
    created_by: t.createdBy ? String(t.createdBy) : (t.created_by ?? null),
    created_at: t.createdAt ?? t.created_at,
    mpesa_ref: t.mpesaRef ?? t.mpesa_ref ?? null,
    members: memberObj
      ? { name: memberObj.name, member_id: memberObj.memberId ?? memberObj.member_id }
      : (t.members ?? null),
  };
}

export function normalizeNotification(n: DbDocument) {
  if (!n) return n;
  n = base(n);
  return {
    ...n,
    id: n.id || String(n._id),
    user_id: n.userId ? String(n.userId) : (n.user_id ?? null),
    created_at: n.createdAt ?? n.created_at,
  };
}

export function normalizeAuditLog(a: DbDocument) {
  if (!a) return a;
  a = base(a);
  return {
    ...a,
    id: a.id || String(a._id),
    user_id: a.userId ? String(a.userId) : (a.user_id ?? null),
    table_name: a.tableName ?? a.table_name,
    record_id: a.recordId ?? a.record_id ?? null,
    ip_address: a.ipAddress ?? a.ip_address ?? null,
    created_at: a.createdAt ?? a.created_at,
  };
}

// ─── Admin Communications API ──────────────────────────────────────────────

export interface MemberMessageItem {
  _id: string;
  subject: string;
  message: string;
  senderName: string;
  senderContact: string | null;
  source: string;
  status: "new" | "read";
  createdAt: string;
}

export interface AdminEmailBroadcastPayload {
  subject: string;
  message: string;
  dryRun?: boolean;
  isHtml?: boolean;
  templateMode?: "plain" | "branded";
  recipientMode?: "filters" | "manual";
  filters?: {
    staffOnly?: boolean;
    activeMembersOnly?: boolean;
    verifiedUsersOnly?: boolean;
  };
  selectedMemberIds?: string[];
  manualEmails?: string[];
}

export interface AdminEmailBroadcastResponse {
  dryRun: boolean;
  recipients: {
    fromUsers: number;
    fromMembers: number;
    dedupedTotal: number;
    skippedByCap: number;
    attempted: number;
  };
  delivery?: {
    sent: number;
    failed: number;
  };
}

let bridgeFeedRetryAfter = 0;

export interface AdminCommsHealthStatus {
  emailApi: {
    ok: boolean;
    status: number | null;
    pathTried: string[];
    message?: string;
  };
  bridgeApi: {
    ok: boolean;
    status: number | null;
    url?: string;
    configured: boolean;
    message?: string;
  };
}

export async function getAdminCommsHealthStatus(): Promise<AdminCommsHealthStatus> {
  const emailPaths = [
    "/communications/history",
    "/communications/email-broadcast-history",
  ];

  let emailOk = false;
  let emailStatus: number | null = null;
  let emailMessage = "";

  for (const path of emailPaths) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
      emailStatus = res.status;
      if (res.ok) {
        emailOk = true;
        emailMessage = "OK";
        break;
      }
      emailMessage = `HTTP ${res.status}`;
    } catch (err) {
      emailMessage = err instanceof Error ? err.message : String(err);
    }
  }

  const mainSmcfUrl =
    (import.meta.env.VITE_MAIN_SMCF_API_URL as string) ||
    (import.meta.env.VITE_SMCF_PAYMENT_URL as string);
  const bridgeKey =
    (import.meta.env.VITE_MAIN_SMCF_BRIDGE_KEY as string) ||
    (import.meta.env.VITE_SMCF_API_KEY as string);

  const bridgeConfigured = Boolean(mainSmcfUrl && bridgeKey);
  let bridgeOk = false;
  let bridgeStatus: number | null = null;
  let bridgeMessage = bridgeConfigured ? "" : "Bridge env not configured";
  let bridgeUrl = "";

  if (bridgeConfigured) {
    const bridgeBase = mainSmcfUrl.endsWith("/api")
      ? mainSmcfUrl
      : `${mainSmcfUrl.replace(/\/+$/, "")}/api`;
    bridgeUrl = `${bridgeBase}/member-messages/bridge-feed`;

    try {
      const bridgeRes = await fetch(bridgeUrl, {
        headers: {
          "Content-Type": "application/json",
          "x-bridge-key": bridgeKey,
        },
      });
      bridgeStatus = bridgeRes.status;
      bridgeOk = bridgeRes.ok;
      bridgeMessage = bridgeRes.ok ? "OK" : `HTTP ${bridgeRes.status}`;
    } catch (err) {
      bridgeMessage = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    emailApi: {
      ok: emailOk,
      status: emailStatus,
      pathTried: emailPaths,
      message: emailMessage || undefined,
    },
    bridgeApi: {
      ok: bridgeOk,
      status: bridgeStatus,
      url: bridgeUrl || undefined,
      configured: bridgeConfigured,
      message: bridgeMessage || undefined,
    },
  };
}

export async function getAdminMemberMessages(): Promise<MemberMessageItem[]> {
  try {
    const res = await api.get<MemberMessageItem[]>("/communications/member-messages");
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.error("Error fetching admin member messages:", err);
    return [];
  }
}

export async function getMainSmcfBridgeMessages(): Promise<MemberMessageItem[]> {
  try {
    const now = Date.now();
    if (bridgeFeedRetryAfter > now) {
      return [];
    }

    // Try to get bridge messages from Main SMCF admin if env vars are configured
    const mainSmcfUrl = 
      (import.meta.env.VITE_MAIN_SMCF_API_URL as string) || 
      (import.meta.env.VITE_SMCF_PAYMENT_URL as string);
    const bridgeKey = 
      (import.meta.env.VITE_MAIN_SMCF_BRIDGE_KEY as string) || 
      (import.meta.env.VITE_SMCF_API_KEY as string);

    if (!mainSmcfUrl || !bridgeKey) {
      return [];
    }

    const bridgeBase = mainSmcfUrl.endsWith("/api") ? mainSmcfUrl : `${mainSmcfUrl.replace(/\/+$/, "")}/api`;
    const res = await fetch(`${bridgeBase}/member-messages/bridge-feed`, {
      headers: {
        "Content-Type": "application/json",
        "x-bridge-key": bridgeKey,
      },
    });

    if (!res.ok) {
      if (res.status >= 500) {
        bridgeFeedRetryAfter = Date.now() + 60_000;
      }
      return [];
    }

    bridgeFeedRetryAfter = 0;

    const data = await res.json();
    const messages = Array.isArray(data) ? data : (data?.data ?? []);
    return messages.map((m: any) => ({
      _id: m._id || m.id || "",
      subject: m.subject || "",
      message: m.message || m.messageBody || "",
      senderName: m.senderName || m.sender_name || "Unknown",
      senderContact: m.senderContact || m.sender_contact || null,
      source: m.source || "main-smcf",
      status: m.status || "new",
      createdAt: m.createdAt || m.created_at || new Date().toISOString(),
    }));
  } catch {
    bridgeFeedRetryAfter = Date.now() + 60_000;
    return [];
  }
}

export async function getAdminEmailBroadcastHistory(): Promise<any[]> {
  const candidatePaths = [
    "/communications/history",
    "/communications/email-broadcast-history",
  ];

  for (const path of candidatePaths) {
    try {
      const result = await api.get(path);
      return Array.isArray(result) ? result : [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Try next path only for 404/not-found style errors
      if (!/404|not found/i.test(msg)) {
        console.error("Error fetching broadcast history:", err);
        return [];
      }
    }
  }

  console.error("Error fetching broadcast history: no matching API route found");
  return [];
}

export async function markAdminMemberMessageRead(messageId: string): Promise<void> {
  try {
    await api.patch(`/communications/member-messages/${messageId}/read`);
  } catch (err) {
    console.error("Error marking message as read:", err);
    throw err;
  }
}

export async function sendAdminEmailBroadcast(
  payload: AdminEmailBroadcastPayload
): Promise<AdminEmailBroadcastResponse> {
  const candidatePaths = [
    "/communications/email-broadcast",
    "/email/broadcast",
  ];

  let lastError: unknown;
  for (const path of candidatePaths) {
    try {
      return await api.post(path, payload);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Try next path only for 404/not-found style errors
      if (!/404|not found/i.test(msg)) {
        console.error("Error sending broadcast:", err);
        throw err;
      }
    }
  }

  console.error("Error sending broadcast:", lastError);
  throw (lastError instanceof Error
    ? lastError
    : new Error("No matching email broadcast API route found"));
}
