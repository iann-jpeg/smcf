/**
 * SMCF Loan Terms & Conditions PDF Generator
 * Kenyan-Compliant Legal Document
 */

export const generateLoanTermsPDF = () => {
  const POLICY_VERSION = "SMCF-LOAN-POLICY-2026-01";
  const POLICY_DATE = "January 1, 2026";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Loan Terms & Conditions</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.6;
      color: #000;
      font-size: 11pt;
      margin: 0;
      padding: 0;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 25px;
    }
    
    .header h1 {
      font-size: 20pt;
      margin: 0 0 5px 0;
      color: #2563eb;
      font-weight: bold;
    }
    
    .header h2 {
      font-size: 16pt;
      margin: 5px 0;
      color: #333;
    }
    
    .header .subtitle {
      font-size: 10pt;
      color: #666;
      margin-top: 8px;
      font-style: italic;
    }
    
    .policy-info {
      background: #f3f4f6;
      border: 2px solid #2563eb;
      padding: 12px;
      margin: 20px 0;
      text-align: center;
      border-radius: 5px;
    }
    
    .policy-info strong {
      color: #2563eb;
      font-size: 12pt;
    }
    
    .section {
      margin: 25px 0;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 13pt;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 12px;
      padding-bottom: 5px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .section p {
      margin: 8px 0;
      text-align: justify;
    }
    
    .section ul {
      margin: 10px 0;
      padding-left: 30px;
    }
    
    .section li {
      margin: 6px 0;
      text-align: justify;
    }
    
    .nested-list {
      margin-top: 8px;
      padding-left: 25px;
      list-style-type: circle;
    }
    
    .warning-box {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
      page-break-inside: avoid;
    }
    
    .warning-box p {
      margin: 5px 0;
      font-weight: bold;
      text-align: center;
    }
    
    .warning-box .warning-text {
      font-size: 14pt;
      color: #d97706;
    }
    
    .warning-box .warning-detail {
      font-size: 9pt;
      font-weight: normal;
      color: #92400e;
      margin-top: 10px;
    }
    
    .highlight {
      background: #fef3c7;
      padding: 2px 6px;
      font-weight: bold;
      border-radius: 3px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #2563eb;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    
    .footer p {
      margin: 5px 0;
    }
    
    .signature-section {
      margin-top: 40px;
      padding: 20px;
      border: 2px solid #e5e7eb;
      background: #f9fafb;
      page-break-inside: avoid;
    }
    
    .signature-section p {
      margin: 10px 0;
      font-size: 10pt;
    }
    
    .signature-line {
      margin-top: 30px;
      border-top: 1px solid #000;
      width: 250px;
      padding-top: 5px;
      font-size: 9pt;
    }
    
    strong {
      font-weight: bold;
    }
    
    em {
      font-style: italic;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>SMART MONEY CASH FLOW (SMCF)</h1>
    <h2>LOAN APPLICATION AGREEMENT & DECLARATION</h2>
    <div class="subtitle">Governed by the Laws of Kenya</div>
  </div>

  <!-- Policy Version -->
  <div class="policy-info">
    <p><strong>Policy Version:</strong> ${POLICY_VERSION}</p>
    <p><strong>Effective Date:</strong> ${POLICY_DATE}</p>
  </div>

  <!-- Section 1: Legal Status -->
  <div class="section">
    <div class="section-title">1. Legal Status</div>
    <p>
      SMART MONEY CASH FLOW (SMCF) operates as a registered table banking / financial 
      pooling organization within the Republic of Kenya.
    </p>
    <p>All loan agreements are governed by:</p>
    <ul>
      <li>The Laws of Kenya</li>
      <li>The Law of Contract Act (Cap 23)</li>
      <li>The Data Protection Act, 2019</li>
      <li>Any applicable financial and civil recovery laws</li>
    </ul>
    <p class="highlight">
      By proceeding, the Member enters into a legally binding agreement with SMCF.
    </p>
  </div>

  <!-- Section 2: Member Declaration -->
  <div class="section">
    <div class="section-title">2. Member Declaration</div>
    <p>I, the undersigned Member, declare that:</p>
    <ul>
      <li>I am an active registered member of SMCF.</li>
      <li>All information provided in this application is true and accurate.</li>
      <li>I understand that providing false information constitutes fraud under Kenyan law.</li>
      <li>I am applying voluntarily and without coercion.</li>
    </ul>
  </div>

  <!-- Section 3: Loan Approval & Disbursement -->
  <div class="section">
    <div class="section-title">3. Loan Approval & Disbursement</div>
    <ul>
      <li>Loan approval is not automatic.</li>
      <li>Approval is subject to internal credit assessment and fund availability.</li>
      <li>SMCF reserves absolute discretion to approve, reject, or vary loan terms.</li>
      <li>No funds shall be disbursed until formal approval is granted.</li>
    </ul>
  </div>

  <!-- Section 4: Repayment Obligation -->
  <div class="section">
    <div class="section-title">4. Repayment Obligation</div>
    <p>I agree that:</p>
    <ul>
      <li>The approved loan shall be repaid within the agreed timeline.</li>
      <li>Interest and administrative fees shall apply as per SMCF loan policy.</li>
      <li>Late payments attract penalties as determined by SMCF.</li>
      <li>
        <strong>In case of default, SMCF may:</strong>
        <ul class="nested-list">
          <li>Deduct from my savings or contributions</li>
          <li>Engage guarantors</li>
          <li>Initiate recovery proceedings</li>
          <li>Report default internally</li>
          <li>Institute civil recovery proceedings under Kenyan law</li>
        </ul>
      </li>
    </ul>
  </div>

  <!-- Section 5: Default and Recovery -->
  <div class="section">
    <div class="section-title">5. Default and Recovery</div>
    <p><strong>If I default:</strong></p>
    <ul>
      <li>SMCF may pursue recovery without further notice.</li>
      <li>I shall bear recovery and legal costs incurred.</li>
      <li>Guarantors may be held jointly and severally liable.</li>
    </ul>
  </div>

  <!-- Section 6: Data Protection Compliance -->
  <div class="section">
    <div class="section-title">6. Data Protection Compliance</div>
    <p>
      In accordance with the <strong>Data Protection Act, 2019</strong>:
    </p>
    <ul>
      <li>I consent to the collection and processing of my personal data.</li>
      <li>My data may be used for credit assessment and recovery.</li>
      <li>SMCF shall implement reasonable safeguards to protect my data.</li>
    </ul>
  </div>

  <!-- Section 7: Electronic Agreement -->
  <div class="section">
    <div class="section-title">7. Electronic Agreement</div>
    <p>I acknowledge that:</p>
    <ul>
      <li>Clicking "I Agree" constitutes a legally binding electronic signature.</li>
      <li>This agreement shall be admissible in any legal proceedings.</li>
      <li>My agreement shall be recorded with timestamp and system logs.</li>
    </ul>
  </div>

  <!-- Section 8: Governing Law -->
  <div class="section">
    <div class="section-title">8. Governing Law</div>
    <p>
      This agreement shall be governed and interpreted under the <strong>Laws of Kenya</strong>.
    </p>
    <p>Disputes shall be resolved within Kenyan jurisdiction.</p>
  </div>

  <!-- Warning Box -->
  <div class="warning-box">
    <p class="warning-text">⚠️ IMPORTANT LEGAL NOTICE ⚠️</p>
    <p class="warning-detail">
      By accepting these terms, you are entering into a legally binding contract.
      Your acceptance will be recorded with your IP address, device information,
      and timestamp for legal audit purposes as required under the Data Protection Act, 2019.
    </p>
  </div>

  <!-- Signature Section -->
  <div class="signature-section">
    <p><strong>ACCEPTANCE & SIGNATURE</strong></p>
    <p>
      I have read, understood, and agree to be bound by the above terms and conditions.
      I acknowledge that this agreement is governed by the Laws of Kenya and constitutes
      a legally binding electronic signature.
    </p>
    
    <div style="display: flex; justify-content: space-between; margin-top: 40px;">
      <div>
        <div class="signature-line">Member Name</div>
      </div>
      <div>
        <div class="signature-line">Date</div>
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-top: 30px;">
      <div>
        <div class="signature-line">Member ID</div>
      </div>
      <div>
        <div class="signature-line">Signature</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p><strong>SMART MONEY CASH FLOW (SMCF)</strong></p>
    <p>Digital Table Banking Platform | Registered in Kenya</p>
    <p>Contact: +254 759 097 157 | Email: info@smcf.app</p>
    <p style="margin-top: 15px;">
      <em>This document is generated by the SMCF system and contains legally binding terms.</em>
    </p>
    <p>
      Policy Version: ${POLICY_VERSION} | Effective Date: ${POLICY_DATE}
    </p>
  </div>
</body>
</html>
  `.trim();

  // Create a new window to print
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    alert('Please allow pop-ups to download the PDF document.');
  }
};
