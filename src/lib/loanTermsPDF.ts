/**
 * SMCF Loan Terms & Conditions PDF Generator
 * Kenyan-Compliant Legal Document
 */

import { jsPDF } from "jspdf";
import { drawSmcfFooterSeal, drawSmcfPageSealWatermark } from "@/lib/pdfSeal";

interface LoanTermsPDFOptions {
  memberId?: string;
  memberName?: string;
}

const sanitizeForFilename = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 40);

export const generateLoanTermsPDF = (options?: LoanTermsPDFOptions) => {
  const POLICY_VERSION = "SMCF-LOAN-POLICY-2026-01";
  const POLICY_DATE = "January 1, 2026";
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensurePageSpace = (requiredHeight = 16) => {
    if (y + requiredHeight > pageHeight - margin - 36) {
      doc.addPage();
      y = margin;
    }
  };

  const writeParagraph = (
    text: string,
    options?: { fontSize?: number; bold?: boolean; gapAfter?: number }
  ) => {
    const fontSize = options?.fontSize ?? 11;
    const gapAfter = options?.gapAfter ?? 8;
    doc.setFont("times", options?.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    ensurePageSpace(lines.length * (fontSize + 2));
    doc.text(lines, margin, y);
    y += lines.length * (fontSize + 2) + gapAfter;
  };

  const writeBullet = (text: string) => {
    const bulletIndent = 14;
    const textWidth = contentWidth - bulletIndent;
    const lines = doc.splitTextToSize(text, textWidth);
    ensurePageSpace(lines.length * 14);
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text("-", margin, y);
    doc.text(lines, margin + bulletIndent, y);
    y += lines.length * 14 + 4;
  };

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("SMART MONEY CASH FLOW (SMCF)", pageWidth / 2, y, {
    align: "center",
  });
  y += 24;

  doc.setFontSize(14);
  doc.text("LOAN APPLICATION AGREEMENT AND DECLARATION", pageWidth / 2, y, {
    align: "center",
  });
  y += 18;

  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.text("Governed by the Laws of Kenya", pageWidth / 2, y, {
    align: "center",
  });
  y += 20;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  writeParagraph(`Policy Version: ${POLICY_VERSION}`, {
    fontSize: 11,
    bold: true,
    gapAfter: 4,
  });
  writeParagraph(`Effective Date: ${POLICY_DATE}`, {
    fontSize: 11,
    bold: true,
    gapAfter: 12,
  });

  writeParagraph("1. Legal Status", { fontSize: 13, bold: true, gapAfter: 6 });
  writeParagraph(
    "SMART MONEY CASH FLOW (SMCF) operates as a registered table banking and financial pooling organization within the Republic of Kenya."
  );
  writeParagraph("All loan agreements are governed by:", { gapAfter: 4 });
  writeBullet("The Laws of Kenya");
  writeBullet("The Law of Contract Act (Cap 23)");
  writeBullet("The Data Protection Act, 2019");
  writeBullet("Any applicable financial and civil recovery laws");
  writeParagraph(
    "By proceeding, the Member enters into a legally binding agreement with SMCF.",
    { bold: true, gapAfter: 12 }
  );

  writeParagraph("2. Member Declaration", {
    fontSize: 13,
    bold: true,
    gapAfter: 6,
  });
  writeParagraph("I, the undersigned Member, declare that:", { gapAfter: 4 });
  writeBullet("I am an active registered member of SMCF.");
  writeBullet("All information provided in this application is true and accurate.");
  writeBullet("I understand that providing false information constitutes fraud under Kenyan law.");
  writeBullet("I am applying voluntarily and without coercion.");
  y += 6;

  writeParagraph("3. Loan Approval and Disbursement", {
    fontSize: 13,
    bold: true,
    gapAfter: 6,
  });
  writeBullet("Loan approval is not automatic.");
  writeBullet("Approval is subject to internal credit assessment and fund availability.");
  writeBullet("SMCF reserves discretion to approve, reject, or vary loan terms.");
  writeBullet("No funds shall be disbursed until formal approval is granted.");
  y += 6;

  writeParagraph("4. Repayment Obligation", {
    fontSize: 13,
    bold: true,
    gapAfter: 6,
  });
  writeParagraph("I agree that:", { gapAfter: 4 });
  writeBullet("The approved loan shall be repaid within the agreed timeline.");
  writeBullet("Interest and administrative fees shall apply as per SMCF loan policy.");
  writeBullet("Late payments attract penalties as determined by SMCF.");
  writeBullet("In case of default, SMCF may deduct from savings or contributions.");
  writeBullet("SMCF may engage guarantors and initiate recovery proceedings.");
  writeBullet("SMCF may institute civil recovery proceedings under Kenyan law.");

  writeParagraph("5. Default and Recovery", {
    fontSize: 13,
    bold: true,
    gapAfter: 6,
  });
  writeBullet("SMCF may pursue recovery without further notice.");
  writeBullet("The Member shall bear recovery and legal costs incurred.");
  writeBullet("Guarantors may be held jointly and severally liable.");

  writeParagraph("6. Data Protection Compliance", {
    fontSize: 13,
    bold: true,
    gapAfter: 6,
  });
  writeParagraph("In accordance with the Data Protection Act, 2019:", {
    gapAfter: 4,
  });
  writeBullet("The Member consents to collection and processing of personal data.");
  writeBullet("Data may be used for credit assessment and recovery.");
  writeBullet("SMCF shall implement reasonable safeguards to protect personal data.");

  writeParagraph("7. Electronic Agreement", {
    fontSize: 13,
    bold: true,
    gapAfter: 6,
  });
  writeBullet("Clicking I Agree constitutes a legally binding electronic signature.");
  writeBullet("This agreement shall be admissible in legal proceedings.");
  writeBullet("Agreement acceptance shall be recorded with timestamp and system logs.");

  writeParagraph("8. Governing Law", { fontSize: 13, bold: true, gapAfter: 6 });
  writeParagraph(
    "This agreement shall be governed and interpreted under the Laws of Kenya. Disputes shall be resolved within Kenyan jurisdiction.",
    { gapAfter: 10 }
  );

  doc.setFillColor(254, 243, 199);
  ensurePageSpace(90);
  doc.roundedRect(margin, y, contentWidth, 78, 4, 4, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("IMPORTANT LEGAL NOTICE", margin + 10, y + 18);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  const warningText = doc.splitTextToSize(
    "By accepting these terms, you enter a legally binding contract. Acceptance may be recorded with IP address, device information, and timestamp for legal audit purposes.",
    contentWidth - 20
  );
  doc.text(warningText, margin + 10, y + 36);
  y += 92;

  ensurePageSpace(120);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("ACCEPTANCE AND SIGNATURE", margin, y);
  y += 18;
  writeParagraph(
    "I have read, understood, and agree to be bound by the above terms and conditions. I acknowledge that this agreement is governed by the Laws of Kenya and constitutes a legally binding electronic signature.",
    { fontSize: 10, gapAfter: 24 }
  );

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text("Member Name: ______________________________", margin, y);
  doc.text("Date: __________________", pageWidth - margin - 180, y);
  y += 26;
  doc.text("Member ID: ________________________________", margin, y);
  doc.text("Signature: ______________", pageWidth - margin - 180, y);

  const totalPages = doc.getNumberOfPages();
  const generatedDate = new Date().toLocaleDateString();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawSmcfPageSealWatermark(doc, pageWidth, pageHeight);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.6);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text(
      `SMCF Loan Terms | ${POLICY_VERSION} | Generated ${generatedDate}`,
      margin,
      pageHeight - 16
    );
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 16, {
      align: "right",
    });
    drawSmcfFooterSeal(doc, pageWidth - 40, pageHeight - 10.5);
  }

  const today = new Date().toISOString().slice(0, 10);
  const memberIdPart = options?.memberId
    ? sanitizeForFilename(options.memberId)
    : "GENERAL";
  const memberNamePart = options?.memberName
    ? sanitizeForFilename(options.memberName)
    : "Member";

  doc.save(
    `SMCF_Loan_Terms_${memberIdPart}_${memberNamePart}_${today}_${POLICY_VERSION}.pdf`
  );
};
