import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LoanSafetyResult } from "@/lib/loan-safety-engine";

const NAVY: [number, number, number] = [15, 23, 42];
const GOLD: [number, number, number] = [180, 150, 60];
const HEADER_COLOR: [number, number, number] = NAVY;
const DATE_FMT = new Intl.DateTimeFormat("en-KE", { dateStyle: "long" });
const SACCO_NAME = "SMCF SACCO";
const SACCO_TAGLINE = "Empowering Members Through Financial Excellence";

function initDoc(title: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Navy header bar
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 28, pageWidth, 2, "F");

  // SACCO name in white
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(SACCO_NAME, 14, 14);

  // Tagline
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 220);
  doc.text(SACCO_TAGLINE, 14, 22);

  // Report title below header
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(title, 14, 40);

  // Generated date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${DATE_FMT.format(new Date())}`, 14, 47);
  doc.setTextColor(0);
  return doc;
}

function addPageFooters(doc: jsPDF, label: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Gold accent line above footer
    doc.setFillColor(...GOLD);
    doc.rect(0, pageHeight - 18, pageWidth, 0.5, "F");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(label, 14, pageHeight - 12);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 12, { align: "center" });
    doc.text(DATE_FMT.format(new Date()), pageWidth - 14, pageHeight - 12, { align: "right" });
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(SACCO_NAME, pageWidth / 2, pageHeight - 7, { align: "center" });
    doc.setTextColor(0);
  }
}

export function exportBalanceSheet(data: {
  totalLoanBalance: number;
  totalSavings: number;
  totalShares: number;
  totalDeposits: number;
  equity: number;
}) {
  const doc = initDoc("Balance Sheet");
  autoTable(doc, {
    startY: 54,
    head: [["Item", "Amount (KES)"]],
    body: [
      [{ content: "Assets", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }],
      ["  Loan Portfolio (Outstanding)", data.totalLoanBalance.toLocaleString()],
      [{ content: "Liabilities", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }],
      ["  Member Savings", data.totalSavings.toLocaleString()],
      [{ content: "Equity", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }],
      ["  Share Capital", data.totalShares.toLocaleString()],
      [{ content: "Total Deposits (Savings + Shares)", styles: { fontStyle: "bold" } }, { content: data.totalDeposits.toLocaleString(), styles: { fontStyle: "bold" } }],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    styles: { halign: "left" },
    columnStyles: { 1: { halign: "right" } },
  });
  doc.save("balance-sheet.pdf");
}

export function exportIncomeStatement(data: {
  interestIncome: number;
  disbursed: number;
  totalTransactions: number;
}) {
  const doc = initDoc("Income Statement");
  autoTable(doc, {
    startY: 54,
    head: [["Metric", "Value"]],
    body: [
      ["Interest Income (Projected)", `KES ${data.interestIncome.toLocaleString()}`],
      ["Total Loans Disbursed", String(data.disbursed)],
      ["Total Transactions", String(data.totalTransactions)],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
  });
  doc.save("income-statement.pdf");
}

export function exportLoanPortfolio(
  summary: { total: number; active: number; defaulted: number; par30: string },
  loans: Array<{ loan_number: string; memberName: string; principal: number; balance: number; status: string; risk_rating: string }>
) {
  const doc = initDoc("Loan Portfolio Report");
  autoTable(doc, {
    startY: 54,
    head: [["Metric", "Value"]],
    body: [
      ["Total Loans", String(summary.total)],
      ["Active", String(summary.active)],
      ["Defaulted", String(summary.defaulted)],
      ["PAR >30", `${summary.par30}%`],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Loan #", "Member", "Principal (KES)", "Balance (KES)", "Status", "Risk"]],
    body: loans.map((l) => [
      l.loan_number,
      l.memberName,
      l.principal.toLocaleString(),
      l.balance.toLocaleString(),
      l.status,
      l.risk_rating ?? "—",
    ]),
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });
  doc.save("loan-portfolio.pdf");
}

export function exportGuarantorExposure(
  rows: Array<{ name: string; total: number; savings: number; maxAllowed: number; ratio: string; count: number }>
) {
  const doc = initDoc("Guarantor Exposure Report");
  autoTable(doc, {
    startY: 54,
    head: [["Guarantor", "Total Guaranteed", "Savings", "Max Allowed", "Exposure %", "Guarantees"]],
    body: rows.map((r) => [
      r.name,
      `KES ${r.total.toLocaleString()}`,
      `KES ${r.savings.toLocaleString()}`,
      `KES ${r.maxAllowed.toLocaleString()}`,
      `${r.ratio}%`,
      String(r.count),
    ]),
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "center" } },
  });
  doc.save("guarantor-exposure.pdf");
}

export function exportMyLoans(
  memberName: string,
  memberId: string,
  rows: Array<{ loan_number: string; principal: number; interest_rate: number; interest_model: string; term_months: number; balance: number; monthly_installment: number; status: string }>
) {
  const doc = initDoc("Loan Statement");
  const pageW = doc.internal.pageSize.getWidth();
  const L = 14;
  const R = pageW - 14;
  const W = R - L;

  // ── Member info box ──────────────────────────────────────────────────────
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(L, 52, W, 22, 2, 2, "F");
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(L, 52, W, 22, 2, 2, "S");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Member Name:", L + 4, 60);
  doc.text("Member ID:", L + W / 2 + 4, 60);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(memberName, L + 36, 60);
  doc.text(memberId, L + W / 2 + 26, 60);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Statement Date:", L + 4, 69);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(DATE_FMT.format(new Date()), L + 38, 69);
  doc.setTextColor(0);

  // ── Summary stats row ────────────────────────────────────────────────────
  const totalPrincipal = rows.reduce((s, r) => s + Number(r.principal), 0);
  const totalBalance   = rows.reduce((s, r) => s + Number(r.balance), 0);
  const totalPaid      = totalPrincipal - totalBalance;
  const activeCount    = rows.filter(r => ["disbursed", "repaying", "active"].includes(r.status)).length;

  const boxes = [
    { label: "Total Loans", value: String(rows.length) },
    { label: "Active", value: String(activeCount) },
    { label: "Total Principal", value: `KES ${totalPrincipal.toLocaleString()}` },
    { label: "Outstanding", value: `KES ${totalBalance.toLocaleString()}` },
    { label: "Total Paid", value: `KES ${totalPaid.toLocaleString()}` },
  ];
  const boxW = W / boxes.length;
  const boxY = 78;

  boxes.forEach(({ label, value }, i) => {
    const bx = L + i * boxW;
    const isLast = i === boxes.length - 1;
    const isFirst = i === 0;

    // Box background — alternate shades
    doc.setFillColor(i % 2 === 0 ? 240 : 248, i % 2 === 0 ? 242 : 250, i % 2 === 0 ? 252 : 255);
    doc.setDrawColor(220, 224, 235);
    doc.setLineWidth(0.2);
    if (isFirst) {
      doc.roundedRect(bx, boxY, boxW - 1, 18, 2, 2, "FD");
    } else if (isLast) {
      doc.roundedRect(bx + 1, boxY, boxW - 1, 18, 2, 2, "FD");
    } else {
      doc.rect(bx + 0.5, boxY, boxW - 1, 18, "FD");
    }

    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(label.toUpperCase(), bx + boxW / 2, boxY + 6, { align: "center" });

    // Value
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(value, bx + boxW / 2, boxY + 13, { align: "center" });
  });

  doc.setTextColor(0);

  // ── Section heading ───────────────────────────────────────────────────────
  const tableStartY = boxY + 24;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Loan Details", L, tableStartY - 3);
  doc.setFillColor(...GOLD);
  doc.rect(L, tableStartY - 1, W, 0.5, "F");

  // ── Status colour helper ──────────────────────────────────────────────────
  function statusColor(status: string): [number, number, number] {
    switch (status.toLowerCase()) {
      case "disbursed": case "repaying": case "active": return [22, 163, 74];  // green
      case "completed": case "paid":                    return [37, 99, 235];  // blue
      case "defaulted": case "overdue":                 return [220, 38, 38];  // red
      case "pending": case "approved":                  return [180, 140, 0];  // amber
      default:                                          return [100, 100, 100];
    }
  }

  // ── Main loans table ──────────────────────────────────────────────────────
  autoTable(doc, {
    startY: tableStartY + 2,
    head: [["#", "Loan No.", "Principal (KES)", "Rate / Model", "Term", "Paid (KES)", "Balance (KES)", "Monthly (KES)", "Status"]],
    body: rows.map((l, idx) => [
      String(idx + 1),
      l.loan_number,
      Number(l.principal).toLocaleString(),
      `${l.interest_rate}% ${l.interest_model}`,
      `${l.term_months} mo`,
      (Number(l.principal) - Number(l.balance)).toLocaleString(),
      Number(l.balance).toLocaleString(),
      Number(l.monthly_installment).toLocaleString(),
      l.status.charAt(0).toUpperCase() + l.status.slice(1),
    ]),
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 28, fontStyle: "bold" },
      2: { halign: "right" },
      3: { halign: "center" },
      4: { halign: "center", cellWidth: 14 },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
      7: { halign: "right" },
      8: { halign: "center", cellWidth: 22 },
    },
    didDrawCell(data) {
      // Colour-code the Status column cells
      if (data.section === "body" && data.column.index === 8) {
        const status = rows[data.row.index]?.status ?? "";
        const [r, g, b] = statusColor(status);
        doc.setTextColor(r, g, b);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const cellText = data.cell.text.join(" ");
        doc.text(cellText, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
        doc.setTextColor(0);
      }
    },
  });

  // ── Totals row ────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 2;
  doc.setFillColor(...NAVY);
  doc.rect(L, finalY, W, 8, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTALS", L + 4, finalY + 5.5);
  const col2x = L + 8 + 28 + 2; // roughly under "Principal" column
  doc.text(`KES ${totalPrincipal.toLocaleString()}`, pageW - 14 - 80, finalY + 5.5, { align: "right" });
  doc.text(`KES ${totalPaid.toLocaleString()}`,      pageW - 14 - 52,  finalY + 5.5, { align: "right" });
  doc.text(`KES ${totalBalance.toLocaleString()}`,   pageW - 14 - 25,  finalY + 5.5, { align: "right" });
  doc.setTextColor(0);
  void col2x; // suppress unused warning

  // ── Disclaimer note ───────────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text(
    "This statement is generated for informational purposes only. For official queries contact SMCF SACCO at +254 759 097 157.",
    L, finalY + 14,
    { maxWidth: W }
  );
  doc.setTextColor(0);

  addPageFooters(doc, `Loan Statement — ${memberName} (${memberId})`);
  doc.save(`SMCF_Loan_Statement_${memberId}.pdf`);
}

export function exportMyRepayments(
  memberName: string,
  memberId: string,
  rows: Array<{ loans?: { loan_number: string } | null; due_date: string; amount_due: number; amount_paid: number; status: string }>
) {
  const doc = initDoc(`Repayment Schedule — ${memberName} (${memberId})`);
  autoTable(doc, {
    startY: 54,
    head: [["Loan #", "Due Date", "Amount Due (KES)", "Paid (KES)", "Status"]],
    body: rows.map((r) => [
      r.loans?.loan_number ?? "—",
      new Date(r.due_date).toLocaleDateString("en-KE"),
      Number(r.amount_due).toLocaleString(),
      Number(r.amount_paid).toLocaleString(),
      r.status,
    ]),
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });
  addPageFooters(doc, `${memberName} (${memberId})`);
  doc.save(`repayments-${memberId}.pdf`);
}

export function exportMyTransactions(
  memberName: string,
  memberId: string,
  rows: Array<{ transaction_ref: string; processed_at: string; type: string; amount: number; status: string; description?: string | null }>
) {
  const doc = initDoc(`Transaction History — ${memberName} (${memberId})`);
  autoTable(doc, {
    startY: 54,
    head: [["Ref", "Date", "Type", "Amount (KES)", "Status", "Description"]],
    body: rows.map((t) => [
      t.transaction_ref,
      new Date(t.processed_at).toLocaleDateString("en-KE"),
      t.type,
      Number(t.amount).toLocaleString(),
      t.status,
      t.description ?? "—",
    ]),
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 3: { halign: "right" } },
  });
  addPageFooters(doc, `${memberName} (${memberId})`);
  doc.save(`transactions-${memberId}.pdf`);
}

export function exportMemberStatements(
  rows: Array<{ member_id: string; name: string; savings: number; shares: number; loan_balance: number; status: string }>
) {
  const doc = initDoc("Member Statements");
  autoTable(doc, {
    startY: 54,
    head: [["Member ID", "Name", "Savings (KES)", "Shares (KES)", "Loan Balance (KES)", "Status"]],
    body: rows.map((m) => [
      m.member_id,
      m.name,
      Number(m.savings).toLocaleString(),
      Number(m.shares).toLocaleString(),
      Number(m.loan_balance).toLocaleString(),
      m.status,
    ]),
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });
  doc.save("member-statements.pdf");
}

export function exportMyStatement(
  memberName: string,
  memberId: string,
  summary: { shares: number; savings: number; loan_balance: number },
  loans: Array<{ loan_number: string; principal: number; interest_rate: number; interest_model: string; term_months: number; balance: number; monthly_installment: number; status: string }>,
  repayments: Array<{ loans?: { loan_number: string } | null; due_date: string; amount_due: number; amount_paid: number; status: string }>,
  transactions: Array<{ transaction_ref: string; processed_at: string; type: string; amount: number; status: string; description?: string | null }>,
  savingsHistory: Array<{ month: string; amount: number }> = [],
  dateRange?: { from?: Date; to?: Date }
) {
  const doc = initDoc(`Member Statement — ${memberName} (${memberId})`);
  if (dateRange?.from || dateRange?.to) {
    const from = dateRange.from ? DATE_FMT.format(dateRange.from) : "Beginning";
    const to = dateRange.to ? DATE_FMT.format(dateRange.to) : "Present";
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${from} — ${to}`, 14, 52);
    doc.setTextColor(0);
  }
  let y = dateRange?.from || dateRange?.to ? 58 : 54;

  // Account Summary
  autoTable(doc, {
    startY: y,
    head: [["Account Summary", "Amount (KES)"]],
    body: [
      ["Share Capital", Number(summary.shares).toLocaleString()],
      ["Savings", Number(summary.savings).toLocaleString()],
      ["Loan Balance", Number(summary.loan_balance).toLocaleString()],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Savings History
  if (savingsHistory.length > 0) {
    doc.setFontSize(13);
    doc.text("Savings History", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Month", "Amount (KES)"]],
      body: savingsHistory.map((s) => [
        new Date(s.month).toLocaleDateString("en-KE", { year: "numeric", month: "short" }),
        Number(s.amount).toLocaleString(),
      ]),
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }
  if (loans.length > 0) {
    doc.setFontSize(13);
    doc.text("Loans", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Loan #", "Principal (KES)", "Rate", "Term", "Balance (KES)", "Monthly (KES)", "Status"]],
      body: loans.map((l) => [
        l.loan_number,
        Number(l.principal).toLocaleString(),
        `${l.interest_rate}% ${l.interest_model}`,
        `${l.term_months}mo`,
        Number(l.balance).toLocaleString(),
        Number(l.monthly_installment).toLocaleString(),
        l.status,
      ]),
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: { 1: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Repayments
  if (repayments.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("Repayment Schedule", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Loan #", "Due Date", "Amount Due (KES)", "Paid (KES)", "Status"]],
      body: repayments.map((r) => [
        r.loans?.loan_number ?? "—",
        new Date(r.due_date).toLocaleDateString("en-KE"),
        Number(r.amount_due).toLocaleString(),
        Number(r.amount_paid).toLocaleString(),
        r.status,
      ]),
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Transactions
  if (transactions.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("Transaction History", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Ref", "Date", "Type", "Amount (KES)", "Status", "Description"]],
      body: transactions.map((t) => [
        t.transaction_ref,
        new Date(t.processed_at).toLocaleDateString("en-KE"),
        t.type,
        Number(t.amount).toLocaleString(),
        t.status,
        t.description ?? "—",
      ]),
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: { 3: { halign: "right" } },
    });
  }

  addPageFooters(doc, `${memberName} (${memberId})`);
  doc.save(`statement-${memberId}.pdf`);
}

// ═══════════════════════════════════════════════════════
// Loan Safety Simulation Reports
// ═══════════════════════════════════════════════════════

interface SimScenario {
  memberName: string;
  memberId: string;
  amount: number;
  trustScore: number;
  guarantorNames: string[];
}

function renderScenarioResult(
  doc: jsPDF,
  label: string,
  scenario: SimScenario,
  result: LoanSafetyResult,
  startY: number,
  saccoCapital: number,
  totalLoansIssued: number,
): number {
  let y = startY;

  // Scenario header
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(label, 14, y);
  y += 5;

  // Member info
  autoTable(doc, {
    startY: y,
    head: [["Parameter", "Value"]],
    body: [
      ["Member", `${scenario.memberName} (${scenario.memberId})`],
      ["Requested Loan", `KES ${scenario.amount.toLocaleString()}`],
      ["Trust Score", String(scenario.trustScore)],
      ["Guarantors", scenario.guarantorNames.length > 0 ? scenario.guarantorNames.join(", ") : "None"],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Decision banner
  const decisionColor: [number, number, number] =
    result.decision === "APPROVE" ? [16, 185, 129] :
    result.decision === "REDUCE" ? [245, 158, 11] : [239, 68, 68];
  doc.setFillColor(...decisionColor);
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 10, 2, 2, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`Decision: ${result.decision}${result.suggestedAmount ? ` — Suggested: KES ${result.suggestedAmount.toLocaleString()}` : ""}`, 20, y + 7);
  doc.setTextColor(0);
  y += 16;

  // Reasons
  if (result.reasons.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    result.reasons.forEach((r) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`• ${r}`, 16, y);
      y += 5;
    });
    y += 2;
  }

  // Layer 1: Safe Loan Limit
  autoTable(doc, {
    startY: y,
    head: [["Layer 1 — Safe Loan Limit", "Value"]],
    body: [
      ["Savings-Based Limit", `KES ${result.layer1.savingsLimit.toLocaleString()}`],
      ["Capital Limit (5% of SACCO)", `KES ${result.layer1.capitalLimit.toLocaleString()}`],
      ["Loan Multiplier", result.layer1.trustScoreTier],
      [{ content: "Safe Loan Limit", styles: { fontStyle: "bold" } }, { content: `KES ${result.layer1.safeLoanLimit.toLocaleString()}`, styles: { fontStyle: "bold" } }],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Layer 2: Risk Assessment
  autoTable(doc, {
    startY: y,
    head: [["Layer 2 — Risk Factor", "Weight", "Score", "Weighted"]],
    body: [
      ...result.layer2.factors.map((f) => [f.label, `${(f.weight * 100).toFixed(0)}%`, String(f.score), String(f.weighted)]),
      [{ content: `Composite: ${result.layer2.riskScore} — ${result.layer2.riskLevel}`, colSpan: 4, styles: { fontStyle: "bold", fillColor: [240, 240, 240] as [number, number, number] } }],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Layer 3: Guarantor Requirements
  if (y > 240) { doc.addPage(); y = 20; }
  autoTable(doc, {
    startY: y,
    head: [["Layer 3 — Guarantor Check", "Value"]],
    body: [
      ["Required Count", String(result.layer3.requiredCount)],
      ["Provided Count", `${result.layer3.providedCount} ${result.layer3.guarantorCountMet ? "✓" : "✗"}`],
      ["Combined Savings", `KES ${result.layer3.totalGuarantorSavings.toLocaleString()}`],
      ["Required (120% coverage)", `KES ${result.layer3.requiredGuarantorSavings.toLocaleString()} ${result.layer3.guarantorStrengthMet ? "✓" : "✗"}`],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Layer 4: Capital Safety
  autoTable(doc, {
    startY: y,
    head: [["Layer 4 — Capital Safety", "Value"]],
    body: [
      ["Current SACCO Exposure", `${(result.layer4.currentExposure * 100).toFixed(1)}%`],
      ["Projected Exposure", `${(result.layer4.projectedExposure * 100).toFixed(1)}%`],
      ["Safety Threshold", "≤ 40%"],
      [{ content: `Status: ${result.layer4.status}`, colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 240, 240] as [number, number, number] } }],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  return y;
}

export function exportSimulationSingle(
  scenario: SimScenario,
  result: LoanSafetyResult,
  saccoCapital: number,
  totalLoansIssued: number,
) {
  const doc = initDoc("Loan Safety Simulation Report");

  // SACCO context
  autoTable(doc, {
    startY: 54,
    head: [["SACCO Context", "Value"]],
    body: [
      ["Total Capital", `KES ${saccoCapital.toLocaleString()}`],
      ["Total Loans Issued", `KES ${totalLoansIssued.toLocaleString()}`],
      ["Current Exposure", `${saccoCapital > 0 ? ((totalLoansIssued / saccoCapital) * 100).toFixed(1) : 0}%`],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
  });
  const afterCtx = (doc as any).lastAutoTable.finalY + 8;

  renderScenarioResult(doc, "Simulation Result", scenario, result, afterCtx, saccoCapital, totalLoansIssued);

  addPageFooters(doc, "Loan Safety Simulation");
  doc.save("loan-simulation.pdf");
}

export function exportSimulationComparison(
  scenarioA: SimScenario,
  resultA: LoanSafetyResult,
  scenarioB: SimScenario,
  resultB: LoanSafetyResult,
  saccoCapital: number,
  totalLoansIssued: number,
) {
  const doc = initDoc("Loan Safety Simulation — Comparison Report");

  // SACCO context
  autoTable(doc, {
    startY: 54,
    head: [["SACCO Context", "Value"]],
    body: [
      ["Total Capital", `KES ${saccoCapital.toLocaleString()}`],
      ["Total Loans Issued", `KES ${totalLoansIssued.toLocaleString()}`],
      ["Current Exposure", `${saccoCapital > 0 ? ((totalLoansIssued / saccoCapital) * 100).toFixed(1) : 0}%`],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" } },
  });
  let y = (doc as any).lastAutoTable.finalY + 8;

  // Side-by-side comparison table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Side-by-Side Comparison", 14, y);
  y += 5;

  const fmtDiff = (a: number, b: number) => {
    const d = b - a;
    return d === 0 ? "—" : `${d > 0 ? "+" : ""}${Math.abs(d) >= 1000 ? `KES ${d.toLocaleString()}` : d}`;
  };

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Scenario A", "Scenario B", "Difference"]],
    body: [
      ["Member", scenarioA.memberName, scenarioB.memberName, scenarioA.memberName === scenarioB.memberName ? "Same" : "Different"],
      ["Decision", resultA.decision, resultB.decision, resultA.decision === resultB.decision ? "Same" : "Different"],
      ["Loan Amount", `KES ${scenarioA.amount.toLocaleString()}`, `KES ${scenarioB.amount.toLocaleString()}`, fmtDiff(scenarioA.amount, scenarioB.amount)],
      ["Safe Loan Limit", `KES ${resultA.layer1.safeLoanLimit.toLocaleString()}`, `KES ${resultB.layer1.safeLoanLimit.toLocaleString()}`, fmtDiff(resultA.layer1.safeLoanLimit, resultB.layer1.safeLoanLimit)],
      ["Risk Score", String(resultA.layer2.riskScore), String(resultB.layer2.riskScore), fmtDiff(resultA.layer2.riskScore, resultB.layer2.riskScore)],
      ["Risk Level", resultA.layer2.riskLevel, resultB.layer2.riskLevel, resultA.layer2.riskLevel === resultB.layer2.riskLevel ? "Same" : "Different"],
      ["Guarantors", `${resultA.layer3.providedCount}/${resultA.layer3.requiredCount}`, `${resultB.layer3.providedCount}/${resultB.layer3.requiredCount}`, "—"],
      ["Guarantor Savings", `KES ${resultA.layer3.totalGuarantorSavings.toLocaleString()}`, `KES ${resultB.layer3.totalGuarantorSavings.toLocaleString()}`, fmtDiff(resultA.layer3.totalGuarantorSavings, resultB.layer3.totalGuarantorSavings)],
      ["Projected Exposure", `${(resultA.layer4.projectedExposure * 100).toFixed(1)}%`, `${(resultB.layer4.projectedExposure * 100).toFixed(1)}%`, "—"],
      ["Capital Safety", resultA.layer4.status, resultB.layer4.status, resultA.layer4.status === resultB.layer4.status ? "Same" : "Different"],
    ],
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "center" } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Detailed Scenario A
  if (y > 200) { doc.addPage(); y = 20; }
  y = renderScenarioResult(doc, "Scenario A — Detail", scenarioA, resultA, y, saccoCapital, totalLoansIssued);

  // Detailed Scenario B
  if (y > 140) { doc.addPage(); y = 20; }
  renderScenarioResult(doc, "Scenario B — Detail", scenarioB, resultB, y, saccoCapital, totalLoansIssued);

  addPageFooters(doc, "Loan Safety Comparison Report");
  doc.save("loan-simulation-comparison.pdf");
}

// ═══════════════════════════════════════════════════════
// Membership Application Form
// ═══════════════════════════════════════════════════════

export function downloadMembershipForm() {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 14;
  const R = pageW - 14;
  const W = R - L;

  // ── Page header (replicate initDoc style without returning early) ──────────
  function drawPageHeader() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 28, pageW, 2, "F");
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(SACCO_NAME, L, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 220);
    doc.text(SACCO_TAGLINE, L, 22);
    doc.setTextColor(0);
  }

  drawPageHeader();

  // Form title block
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("MEMBERSHIP APPLICATION FORM", pageW / 2, 40, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    "Complete all sections in BLOCK CAPITALS using black or blue pen.",
    pageW / 2, 47, { align: "center" }
  );
  doc.text(`Ref: SMCF-MAF-${new Date().getFullYear()}`, R, 47, { align: "right" });
  doc.setTextColor(0);

  let y = 56;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function checkPage(needed = 20) {
    if (y + needed > pageH - 25) {
      doc.addPage();
      // Minimal continuation header
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 10, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`${SACCO_NAME} — Membership Application Form (continued)`, L, 7);
      doc.setTextColor(0);
      y = 18;
    }
  }

  function sectionHeader(title: string) {
    checkPage(14);
    doc.setFillColor(...NAVY);
    doc.rect(L, y, W, 6.5, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title, L + 2, y + 4.5);
    doc.setTextColor(0);
    y += 10;
  }

  function drawField(label: string, x: number, w: number) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(label, x, y);
    doc.setDrawColor(160);
    doc.setLineWidth(0.2);
    doc.line(x, y + 5.5, x + w, y + 5.5);
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
  }

  function field(label: string, x: number, w: number) {
    checkPage(13);
    drawField(label, x, w);
    y += 12;
  }

  function row2(l1: string, l2: string, split = 0.5) {
    checkPage(13);
    const gap = 4;
    drawField(l1, L, W * split - gap / 2);
    drawField(l2, L + W * split + gap / 2, W * (1 - split) - gap / 2);
    y += 12;
  }

  function row3(l1: string, l2: string, l3: string) {
    checkPage(13);
    const gap = 3;
    const w = (W - gap * 2) / 3;
    drawField(l1, L, w);
    drawField(l2, L + w + gap, w);
    drawField(l3, L + (w + gap) * 2, w);
    y += 12;
  }

  function checkboxRow(label: string, options: string[]) {
    checkPage(10);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(`${label}:`, L, y);
    let cx = L + doc.getTextWidth(`${label}:`) + 4;
    doc.setTextColor(0);
    for (const opt of options) {
      doc.setDrawColor(120);
      doc.setLineWidth(0.2);
      doc.rect(cx, y - 3.5, 3.5, 3.5);
      cx += 5.5;
      doc.setFontSize(7.5);
      doc.text(opt, cx, y);
      cx += doc.getTextWidth(opt) + 6;
    }
    y += 8;
  }

  function note(text: string) {
    checkPage(8);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    const lines = doc.splitTextToSize(text, W);
    doc.text(lines, L, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    y += lines.length * 4.5 + 2;
  }

  function spacer(h = 4) { y += h; }

  // ── SECTION 1: PERSONAL DETAILS ──────────────────────────────────────────
  sectionHeader("SECTION 1: PERSONAL DETAILS");
  field("Full Name (as in National ID / Passport)", L, W);
  row2("National ID / Passport No.", "Date of Birth (DD/MM/YYYY)");
  checkboxRow("Gender", ["Male", "Female"]);
  checkboxRow("Marital Status", ["Single", "Married", "Widowed", "Divorced"]);
  row2("Nationality", "Place of Birth", 0.5);
  spacer();

  // ── SECTION 2: RESIDENTIAL ADDRESS ───────────────────────────────────────
  sectionHeader("SECTION 2: RESIDENTIAL ADDRESS");
  field("Physical Address / Estate / Plot No.", L, W);
  row3("Town / City", "County", "Country");
  row2("P.O. Box", "Postal Code", 0.4);
  spacer();

  // ── SECTION 3: CONTACT INFORMATION ───────────────────────────────────────
  sectionHeader("SECTION 3: CONTACT INFORMATION");
  row2("Primary Mobile No. (M-Pesa)", "Alternative Phone No.");
  field("Email Address", L, W);
  spacer();

  // ── SECTION 4: EMPLOYMENT / BUSINESS DETAILS ─────────────────────────────
  sectionHeader("SECTION 4: EMPLOYMENT / BUSINESS DETAILS");
  row2("Occupation / Job Title", "Monthly Gross Income (KES)");
  row2("Employer / Business Name", "Work Phone No.");
  checkboxRow("Employment Status", ["Employed", "Self-Employed", "Business Owner", "Student", "Retired"]);
  field("Source of Funds", L, W * 0.65);
  spacer();

  // ── SECTION 5: BANKING DETAILS ────────────────────────────────────────────
  sectionHeader("SECTION 5: BANKING DETAILS");
  row3("Bank Name", "Branch Name", "Account Number");
  spacer();

  // ── SECTION 6: SHARE SUBSCRIPTION & SAVINGS ──────────────────────────────
  sectionHeader("SECTION 6: SHARE SUBSCRIPTION & SAVINGS");
  note("Minimum: 1 share at KES 1,000 each. Maximum: 100 shares (KES 100,000 total).");
  row3("No. of Shares Subscribed", "Total Share Capital (KES)", "Initial Savings Deposit (KES)");
  spacer();

  // ── SECTION 7: NEXT OF KIN / BENEFICIARY ─────────────────────────────────
  sectionHeader("SECTION 7: NEXT OF KIN / BENEFICIARY");
  field("Full Name of Next of Kin / Beneficiary", L, W);
  row3("Relationship", "Phone Number", "National ID No.");
  row2("Physical Address of Next of Kin", "Email (if any)", 0.55);
  spacer();

  // ── SECTION 8: DECLARATION & SIGNATURE ───────────────────────────────────
  sectionHeader("SECTION 8: DECLARATION & SIGNATURE");
  checkPage(65);

  const declLines = [
    "I, the undersigned, hereby apply for membership of SMCF SACCO and solemnly declare that:",
    "1. The information provided in this form is true, accurate and complete to the best of my knowledge and belief.",
    "2. I agree to be bound by the SACCO's By-Laws, policies and regulations as may be amended from time to time.",
    "3. I consent to background checks and verification of all details provided in this application.",
    "4. I understand that membership is subject to Board approval and payment of the required share capital.",
    "5. I authorise SMCF SACCO to deduct agreed monthly contributions from my designated account or mobile wallet.",
    "6. I confirm that I am not a minor and that I am signing this form of my own free will.",
  ];

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  for (const line of declLines) {
    const wrapped = doc.splitTextToSize(line, W);
    checkPage(wrapped.length * 5 + 2);
    doc.text(wrapped, L, y);
    y += wrapped.length * 5;
  }
  spacer(5);

  // Passport photo box + signature area
  checkPage(50);
  const photoW = 33;
  const photoH = 40;
  const sigStartY = y;

  // Photo box (dashed border)
  doc.setDrawColor(140);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.rect(R - photoW, sigStartY, photoW, photoH);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Affix", R - photoW / 2, sigStartY + photoH / 2 - 7, { align: "center" });
  doc.text("Passport", R - photoW / 2, sigStartY + photoH / 2 - 2, { align: "center" });
  doc.text("Photo Here", R - photoW / 2, sigStartY + photoH / 2 + 3, { align: "center" });

  // Signature & name fields (in the remaining left width)
  const sigW = W - photoW - 6;
  drawField("Applicant Signature", L, sigW * 0.58);
  drawField("Date (DD/MM/YYYY)", L + sigW * 0.62, sigW * 0.38);
  y += 16;
  drawField("Full Name (Print Clearly)", L, sigW);
  y = Math.max(y + 12, sigStartY + photoH + 5);
  spacer(4);

  // ── FOR OFFICIAL USE ONLY ─────────────────────────────────────────────────
  sectionHeader("FOR OFFICIAL USE ONLY");
  row3("Member No. Assigned", "Approved By (Name & Signature)", "Date Approved");
  checkboxRow("Decision", ["Approved", "Rejected", "Deferred — Pending Documents"]);
  field("Remarks / Reason for Decision", L, W);
  row2("Verified By (Staff Name)", "Staff Signature & Date", 0.55);

  // Footer
  addPageFooters(doc, "SMCF SACCO — Membership Application Form | Confidential");
  doc.save("SMCF_SACCO_Membership_Application_Form.pdf");
}

// ═══════════════════════════════════════════════════════
// SMCF SACCO Project Proposal
// ═══════════════════════════════════════════════════════

export function downloadProjectProposal() {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 14;
  const R = pageW - 14;
  const W = R - L;

  // ── Cover Page ────────────────────────────────────────────────────────────
  // Full navy cover
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, pageH, "F");

  // Gold decorative bars
  doc.setFillColor(...GOLD);
  doc.rect(0, 68, pageW, 1.5, "F");
  doc.rect(0, 72, pageW, 0.5, "F");
  doc.rect(0, pageH - 40, pageW, 1.5, "F");
  doc.rect(0, pageH - 36, pageW, 0.5, "F");

  // Logo area — gold circle accent
  doc.setFillColor(180, 150, 60, 30);
  doc.circle(pageW / 2, 44, 22, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.circle(pageW / 2, 44, 22, "S");
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  doc.text("SMCF", pageW / 2, 48, { align: "center" });

  // Organisation name
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("SMART MOVES CASH FLOW (SMCF) SACCO", pageW / 2, 82, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD);
  doc.text("Digital Community Savings and Credit Cooperative", pageW / 2, 90, { align: "center" });

  // Main title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("PROJECT PROPOSAL", pageW / 2, 118, { align: "center" });

  // Subtitle rule
  doc.setFillColor(...GOLD);
  doc.rect(pageW / 2 - 30, 122, 60, 0.8, "F");

  // Tagline
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(200, 200, 220);
  const taglineLines = doc.splitTextToSize(
    "Combining the strength of cooperative finance with the power of digital technology " +
    "to empower members through disciplined savings and responsible lending.",
    W - 20
  );
  doc.text(taglineLines, pageW / 2, 132, { align: "center" });

  // Pillars
  const pillars = ["Savings", "Loans", "Transparency", "Technology", "Growth"];
  const pillW = (W - 8) / pillars.length;
  let px = L;
  pillars.forEach((p) => {
    doc.setFillColor(255, 255, 255, 15);
    doc.roundedRect(px, 150, pillW - 2, 12, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GOLD);
    doc.text(p, px + (pillW - 2) / 2, 157.5, { align: "center" });
    px += pillW;
  });

  // Prepared for / by / date block
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 190, 210);
  const infoY = pageH - 55;
  const col1 = L + 10;
  const col2 = pageW / 2 + 5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  doc.text("Prepared for:", col1, infoY);
  doc.text("Prepared by:", col2, infoY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 225, 235);
  doc.text("SMART MOVES CASH FLOW (SMCF)", col1, infoY + 6);
  doc.text("SMCF Management Team", col2, infoY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  doc.text("Date:", col1, infoY + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 225, 235);
  doc.text(DATE_FMT.format(new Date()), col1, infoY + 20);

  // Confidentiality notice
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 150);
  doc.text(
    "CONFIDENTIAL — This document is intended solely for the use of SMCF SACCO and its authorised representatives.",
    pageW / 2, pageH - 10, { align: "center" }
  );

  // ── Content pages ─────────────────────────────────────────────────────────
  doc.addPage();

  let y = 0;

  function drawHeader() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 22, pageW, 1.5, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("SMCF SACCO — Project Proposal", L, 14);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GOLD);
    doc.text(DATE_FMT.format(new Date()), R, 14, { align: "right" });
    doc.setTextColor(0);
  }

  drawHeader();
  y = 32;

  function checkPage(needed = 18) {
    if (y + needed > pageH - 22) {
      doc.addPage();
      drawHeader();
      y = 32;
    }
  }

  function sectionHeader(num: string, title: string) {
    checkPage(18);
    // Gold left accent bar
    doc.setFillColor(...GOLD);
    doc.rect(L, y, 3, 8, "F");
    // Navy bg remaining
    doc.setFillColor(...NAVY);
    doc.rect(L + 3, y, W - 3, 8, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${num}  ${title.toUpperCase()}`, L + 6, y + 5.8);
    doc.setTextColor(0);
    y += 13;
  }

  function paragraph(text: string, indent = 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(text, W - indent);
    checkPage(lines.length * 5.5 + 3);
    doc.text(lines, L + indent, y);
    y += lines.length * 5.5 + 3;
  }

  function bullet(text: string) {
    checkPage(8);
    doc.setFillColor(...GOLD);
    doc.circle(L + 3, y - 1.2, 1.1, "F");
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(text, W - 10);
    doc.text(lines, L + 8, y);
    y += lines.length * 5.5 + 1.5;
  }

  function subHeading(text: string) {
    checkPage(10);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(text, L, y);
    doc.setTextColor(0);
    y += 7;
  }

  function infoBox(label: string, value: string) {
    checkPage(12);
    doc.setFillColor(245, 247, 252);
    doc.roundedRect(L, y, W, 9, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(label, L + 3, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50);
    doc.text(value, L + 3 + doc.getTextWidth(label) + 4, y + 6);
    doc.setTextColor(0);
    y += 12;
  }

  function spacer(h = 5) { y += h; }

  // ── Table of Contents ─────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("TABLE OF CONTENTS", L, y);
  doc.setFillColor(...GOLD);
  doc.rect(L, y + 2, 60, 0.6, "F");
  y += 10;

  const toc = [
    ["1.", "Executive Summary"],
    ["2.", "Background and Rationale"],
    ["3.", "Vision & Mission"],
    ["4.", "Objectives"],
    ["5.", "Target Members"],
    ["6.", "Contribution Structure"],
    ["7.", "Loan Services"],
    ["8.", "Technology & Digital Platform"],
    ["9.", "Financial Sustainability"],
    ["10.", "Governance and Management"],
    ["11.", "Membership Application Process"],
    ["12.", "Expected Impact"],
    ["13.", "Implementation Plan"],
    ["14.", "Conclusion"],
  ];

  toc.forEach(([num, title]) => {
    checkPage(7);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(num, L + 2, y);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text(title, L + 14, y);
    // Dot leader
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180);
    const titleEnd = L + 14 + doc.getTextWidth(title) + 2;
    for (let dx = titleEnd; dx < R - 6; dx += 3) doc.text(".", dx, y);
    y += 6.5;
  });
  spacer(4);

  // ── Section 1 ─────────────────────────────────────────────────────────────
  sectionHeader("1", "Executive Summary");
  paragraph(
    "SMART MOVES CASH FLOW (SMCF) SACCO is a digital-first savings and credit cooperative designed to empower individuals and small businesses to grow financially through disciplined savings, affordable loans, and transparent financial management."
  );
  paragraph(
    "The SACCO leverages modern financial technology and mobile payment integration, including M-PESA, to simplify contributions, loan processing, and financial tracking for members."
  );
  paragraph(
    "SMCF aims to create a trusted financial ecosystem where members can save consistently, access fair loans, and benefit from shared financial growth. The system provides real-time dashboards, automated loan safety checks, and transparent records to ensure accountability and sustainability."
  );
  spacer();

  // ── Section 2 ─────────────────────────────────────────────────────────────
  sectionHeader("2", "Background and Rationale");
  paragraph(
    "Savings and Credit Cooperative Organizations (SACCOs) have become one of the most reliable financial systems for community-based financial empowerment. In Kenya, SACCOs provide accessible credit and encourage a strong culture of saving."
  );
  paragraph("However, many SACCOs still operate with significant limitations:");
  ["Manual record keeping", "Slow loan approval processes", "Limited financial transparency", "Minimal digital integration"].forEach(bullet);
  paragraph(
    "SMCF SACCO seeks to solve these challenges by introducing a modern digital SACCO platform that allows members to manage their finances efficiently from anywhere, at any time."
  );
  spacer();

  // ── Section 3 ─────────────────────────────────────────────────────────────
  sectionHeader("3", "Vision & Mission");
  subHeading("Vision");
  paragraph(
    "To build a trusted digital financial community that empowers members to achieve sustainable wealth through disciplined savings and responsible borrowing."
  );
  subHeading("Mission");
  paragraph(
    "To provide a secure, transparent, and accessible savings and loan platform that promotes financial growth, accountability, and community empowerment."
  );
  spacer();

  // ── Section 4 ─────────────────────────────────────────────────────────────
  sectionHeader("4", "Objectives");
  paragraph("The main objectives of SMCF SACCO include:");
  [
    "Encourage consistent savings among members",
    "Provide affordable and accessible loans",
    "Promote financial discipline and responsibility",
    "Offer a transparent and accountable financial management system",
    "Build a scalable digital SACCO platform",
    "Empower members through shared financial growth",
  ].forEach(bullet);
  spacer();

  // ── Section 5 ─────────────────────────────────────────────────────────────
  sectionHeader("5", "Target Members");
  paragraph(
    "SMCF SACCO targets individuals who value financial discipline and cooperative growth, including:"
  );
  ["Young professionals", "Small business owners", "Entrepreneurs", "Digital workers and freelancers", "Community groups", "Students preparing for financial independence"].forEach(bullet);
  spacer(3);
  infoBox("Launch Target:", "50 founding members");
  infoBox("Year 1 Target:", "150 – 300 members");
  spacer();

  // ── Section 6 ─────────────────────────────────────────────────────────────
  sectionHeader("6", "Contribution Structure");
  paragraph(
    "Members will contribute monthly savings to build the SACCO capital pool. Savings determine loan eligibility and influence future dividends."
  );
  spacer(3);
  // Tiers table
  checkPage(40);
  autoTable(doc, {
    startY: y,
    head: [["Tier", "Monthly Contribution", "Notes"]],
    body: [
      ["Starter Tier", "KES 3,000", "Entry-level savings commitment"],
      ["Growth Tier", "KES 5,000", "Recommended for active loan eligibility"],
      ["Power Tier", "KES 7,000 – 10,000", "Maximum influence on dividends & loan limits"],
    ],
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: 30 },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: { 1: { fontStyle: "bold", halign: "right" }, 2: { textColor: 80 } },
    margin: { left: L, right: L },
    tableLineColor: [220, 225, 235],
    tableLineWidth: 0.2,
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  spacer();

  // ── Section 7 ─────────────────────────────────────────────────────────────
  sectionHeader("7", "Loan Services");
  paragraph(
    "SMCF SACCO provides members with access to structured loan facilities based on savings history and system-based risk evaluation."
  );
  subHeading("Loan Policies");
  ["Loan eligibility based on savings multiplier", "Risk-based loan approval system", "Guarantor requirements for large loans", "Structured repayment plans", "Fair and sustainable interest rates"].forEach(bullet);
  paragraph(
    "All loan approvals are supported by a digital Loan Safety Algorithm that evaluates risk, capital exposure, and guarantor strength before any disbursement."
  );
  spacer();

  // ── Section 8 ─────────────────────────────────────────────────────────────
  sectionHeader("8", "Technology & Digital Platform");
  paragraph(
    "SMCF SACCO operates through a web-based management system with integrated financial tools accessible to all members."
  );
  subHeading("Key Platform Features");
  [
    "Member management dashboard",
    "Automated savings tracking",
    "Loan eligibility calculator",
    "Real-time financial reporting",
    "M-PESA contribution integration",
    "Digital loan application system",
    "Guarantor management module",
    "Secure document uploads for membership verification",
  ].forEach(bullet);
  paragraph(
    "The digital platform allows members to track their savings, loan balances, and financial growth transparently from any device."
  );
  spacer();

  // ── Section 9 ─────────────────────────────────────────────────────────────
  sectionHeader("9", "Financial Sustainability");
  paragraph("The SACCO will generate operational income through:");
  ["Loan interest income", "Loan processing fees", "Membership registration fees"].forEach(bullet);
  spacer(3);
  infoBox("Estimated Monthly Operating Cost:", "KES 15,000 – 25,000");
  infoBox("Break-even Loan Portfolio Target:", "KES 2,500,000 in active loans");
  paragraph(
    "Operational costs cover system hosting, SMS notifications, platform maintenance, and administrative expenses."
  );
  spacer();

  // ── Section 10 ────────────────────────────────────────────────────────────
  sectionHeader("10", "Governance and Management");
  paragraph(
    "SMCF SACCO will operate under structured governance to ensure transparency and accountability in all financial decisions."
  );
  subHeading("Proposed Leadership Structure");
  ["Chairperson", "Treasurer", "Secretary", "Loan Committee", "System Administrator"].forEach(bullet);
  paragraph(
    "Major financial decisions, loan approvals, and policy changes will follow documented SACCO procedures and require appropriate committee sign-off."
  );
  spacer();

  // ── Section 11 ────────────────────────────────────────────────────────────
  sectionHeader("11", "Membership Application Process");
  paragraph("To join SMCF SACCO, prospective members will complete the following steps:");
  [
    "Download the official membership application form from the SMCF platform",
    "Fill out personal and financial details in block capitals",
    "Sign and date the declaration section",
    "Attach required identification documents (National ID / Passport)",
    "Scan and upload the signed form to the SMCF member portal for review",
  ].forEach(bullet);
  paragraph(
    "Once approved, the member will receive a unique Member ID and begin monthly contributions in their chosen tier."
  );
  spacer();

  // ── Section 12 ────────────────────────────────────────────────────────────
  sectionHeader("12", "Expected Impact");
  paragraph("The SMCF SACCO initiative aims to deliver the following outcomes:");
  [
    "Promote disciplined financial habits among members",
    "Increase access to affordable credit in underserved communities",
    "Support small businesses and entrepreneurs with flexible loan facilities",
    "Build a strong, engaged financial community",
    "Enable long-term wealth creation through collective saving",
  ].forEach(bullet);
  spacer();

  // ── Section 13 ────────────────────────────────────────────────────────────
  sectionHeader("13", "Implementation Plan");
  spacer(3);
  checkPage(60);
  autoTable(doc, {
    startY: y,
    head: [["Phase", "Activity", "Focus Area"]],
    body: [
      ["Phase 1", "System Development", "Development of the SMCF SACCO digital platform and membership system"],
      ["Phase 2", "Founding Member Recruitment", "Onboarding of 50 founding members and initial capital pool formation"],
      ["Phase 3", "Contribution Activation", "Start of monthly contributions and capital growth"],
      ["Phase 4", "Loan Services Launch", "Activation of loan services once safe capital thresholds are reached"],
      ["Phase 5", "Expansion", "Growth to 150–300 members within the first operational year"],
    ],
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: 30 },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: {
      0: { fontStyle: "bold", textColor: NAVY as [number,number,number], cellWidth: 22 },
      1: { fontStyle: "bold", cellWidth: 50 },
      2: { textColor: 60 },
    },
    margin: { left: L, right: L },
    tableLineColor: [220, 225, 235],
    tableLineWidth: 0.2,
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  spacer();

  // ── Section 14 ────────────────────────────────────────────────────────────
  sectionHeader("14", "Conclusion");
  paragraph(
    "SMART MOVES CASH FLOW (SMCF) SACCO aims to combine the traditional strength of cooperative finance with the power of digital technology."
  );
  paragraph(
    "Through disciplined savings, responsible lending, and transparent financial systems, SMCF SACCO will create a reliable financial platform that supports members in achieving long-term financial stability and growth."
  );
  paragraph(
    "The success of SMCF SACCO will depend on the commitment of its members, effective governance, and continued innovation in financial management systems."
  );
  spacer(6);

  // Closing signature block
  checkPage(40);
  doc.setFillColor(248, 250, 255);
  doc.roundedRect(L, y, W, 32, 2, 2, "F");
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(L, y, W, 32, 2, 2, "S");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Prepared for:", L + 4, y + 8);
  doc.text("Prepared by:", pageW / 2 + 4, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  doc.text("SMART MOVES CASH FLOW (SMCF)", L + 4, y + 15);
  doc.text("SMCF Management Team", pageW / 2 + 4, y + 15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Date:", L + 4, y + 23);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  doc.text(DATE_FMT.format(new Date()), L + 4, y + 29);
  y += 38;

  addPageFooters(doc, "SMCF SACCO — Project Proposal | Confidential");
  doc.save("SMCF_SACCO_Project_Proposal.pdf");
}

export function downloadBrandedPolicyDocument(
  title: string,
  fileName: string,
  lines: string[]
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 14;
  const W = pageW - 28;

  const drawHeader = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 28, pageW, 2, "F");

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(SACCO_NAME, L, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 220);
    doc.text(SACCO_TAGLINE, L, 22);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(title, L, 40);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated: ${DATE_FMT.format(new Date())}`, L, 47);
    doc.setTextColor(0);
  };

  drawHeader();
  let y = 58;

  const ensureSpace = (needed = 8) => {
    if (y + needed > pageH - 24) {
      doc.addPage();
      drawHeader();
      y = 58;
    }
  };

  lines.forEach((line) => {
    if (line.trim() === "") {
      y += 3;
      return;
    }

    const isHeading =
      /^[0-9]+\./.test(line) ||
      /^[A-Z][A-Z\s()\-:]+$/.test(line) ||
      line.endsWith(":");

    doc.setFont("helvetica", isHeading ? "bold" : "normal");
    doc.setFontSize(isHeading ? 10 : 9);
    doc.setTextColor(isHeading ? NAVY[0] : 40, isHeading ? NAVY[1] : 40, isHeading ? NAVY[2] : 40);

    const wrapped = doc.splitTextToSize(line, W);
    ensureSpace(wrapped.length * 5 + 2);
    doc.text(wrapped, L, y);
    y += wrapped.length * 5 + (isHeading ? 1.5 : 0.8);
  });

  addPageFooters(doc, `SMCF SACCO — ${title}`);
  doc.save(fileName);
}
