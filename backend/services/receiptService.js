import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

/**
 * Generate a PDF receipt for a loan disbursement styled like the provided sample.
 * @param {Object} receiptData - All details needed for the receipt
 * @param {string} receiptData.transactionId
 * @param {string} receiptData.date
 * @param {string} receiptData.fromName
 * @param {string} receiptData.fromAccount
 * @param {string} receiptData.toName
 * @param {string} receiptData.toPhone
 * @param {string} receiptData.amount
 * @param {string} [receiptData.category]
 * @param {string} [receiptData.subCategory]
 * @returns {Promise<string>} - Path to the generated PDF file
 */
export async function generateLoanReceiptPDF(receiptData) {
  const html = `
    <html>
      <head>
        <style>
          body { background: #0a1c0a; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; }
          .container { max-width: 400px; margin: 40px auto; background: #111; border-radius: 16px; box-shadow: 0 4px 24px #0008; padding: 0 0 24px 0; }
          .header { background: #0a1c0a; border-radius: 16px 16px 0 0; padding: 24px 0 8px 0; text-align: center; }
          .success { color: #7fff00; font-size: 1.3em; font-weight: bold; }
          .txid { color: #7fff00; }
          .date { color: #b2ffb2; font-size: 0.95em; }
          .check { font-size: 3em; color: #7fff00; margin: 16px 0; }
          .amount { color: #7fff00; font-size: 2em; font-weight: bold; margin: 8px 0; }
          .section { margin: 18px 24px; }
          .label { color: #b2ffb2; font-size: 0.95em; }
          .value { color: #fff; font-size: 1.1em; font-weight: 500; }
          .divider { border-top: 1px dashed #7fff00; margin: 18px 0; }
          .actions { display: flex; justify-content: space-around; margin: 18px 0 0 0; color: #7fff00; font-size: 0.95em; }
          .done { background: #7fff00; color: #111; text-align: center; font-weight: bold; border-radius: 0 0 16px 16px; padding: 12px 0; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>Transaction Details</div>
            <div class="success">Success</div>
            <div class="txid">Transaction ID : <b>${receiptData.transactionId}</b></div>
            <div class="date">Date : ${receiptData.date}</div>
          </div>
          <div class="section" style="text-align:center;">
            <div class="check">&#10004;</div>
            <div>Send To Mpesa</div>
            <div class="amount">${receiptData.amount} KES</div>
          </div>
          <div class="section">
            <div class="label">From</div>
            <div class="value">Account Name: ${receiptData.fromName}</div>
            <div class="value">Account Number: ${receiptData.fromAccount}</div>
          </div>
          <div class="section">
            <div class="label">Transaction Details</div>
            <div class="value">To: ${receiptData.toName}</div>
            <div class="value">Phone Number: ${receiptData.toPhone}</div>
            <div class="value">Category: ${receiptData.category || "-"}</div>
            <div class="value">Sub Category: ${receiptData.subCategory || "-"}</div>
          </div>
          <div class="divider"></div>
          <div class="actions">
            <div>Save Beneficiary</div>
            <div>Download Receipt</div>
            <div>Share Receipt</div>
          </div>
          <div class="done">Done</div>
        </div>
      </body>
    </html>
  `;

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfPath = path.join(
    process.cwd(),
    `receipts/loan-receipt-${receiptData.transactionId}.pdf`
  );
  // Ensure receipts directory exists
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  await page.pdf({ path: pdfPath, format: "A5", printBackground: true });
  await browser.close();
  return pdfPath;
}
