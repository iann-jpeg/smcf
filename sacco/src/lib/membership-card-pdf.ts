import jsPDF from "jspdf";
import { format } from "date-fns";
import qs from "qs";
import { drawSmcfPageSealWatermark, drawSmcfFooterSeal } from "./pdfSeal";

// Types
type NormalizedMember = any; // Will use the one from api.ts via actual import

const NAVY: [number, number, number] = [15, 23, 42];
const GOLD: [number, number, number] = [180, 150, 60];
const SACCO_NAME = "SMCF SACCO";
const TITLE = "OFFICIAL MEMBERSHIP CARD";

export async function exportMembershipCard(member: any) {
  // CR80 dimensions
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [85.6, 54],
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(252, 253, 255);
  doc.rect(0, 0, width, height, "F");
  
  // Try to draw watermark - we must scale it down heavily, typical A4 is ~210x297
  // We'll skip watermark for ID card or apply it differently if it overpowers
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.05 }));
  doc.setFillColor(...NAVY);
  // Just a subtle background pattern or angled text instead of full seal if it's too big
  doc.setFontSize(30);
  doc.setFont("helvetica", "bold");
  doc.text("SMCF SACCO", width / 2, height / 2 + 10, { angle: -30, align: "center" });
  doc.restoreGraphicsState();

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 12, "F");

  doc.setFillColor(...GOLD);
  doc.rect(0, 12, width, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(SACCO_NAME, width / 2, 6, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(TITLE, width / 2, 10, { align: "center" });

  // Photo
  // We'll draw a rectangle placeholder if no photo
  const photoSize = 22;
  const photoX = 5;
  const photoY = 17;
  
  doc.setFillColor(230, 230, 230);
  doc.rect(photoX, photoY, photoSize, photoSize, "F");
  
  doc.setTextColor(150);
  doc.setFontSize(6);
  doc.text("PHOTO", photoX + photoSize / 2, photoY + photoSize / 2, { align: "center", baseline: "middle" });

  // If member has profile_photo, we can embed it
  if (member.profile_photo) {
    try {
      doc.addImage(member.profile_photo, "JPEG", photoX, photoY, photoSize, photoSize);
    } catch (e) {
      console.warn("Failed to load profile photo for PDF", e);
    }
  }

  // Member Details
  const detailsX = photoX + photoSize + 4;
  let detailsY = 20;

  doc.setTextColor(...NAVY);
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("Name", detailsX, detailsY);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  detailsY += 4;
  // Truncate name if too long
  const name = member.name.length > 22 ? member.name.substring(0, 20) + "..." : member.name;
  doc.text(name.toUpperCase(), detailsX, detailsY);

  detailsY += 5;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("Member ID", detailsX, detailsY);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(member.member_id || "N/A", detailsX + 25, detailsY);

  detailsY += 4;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("Joined", detailsX, detailsY);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const joinDate = member.join_date ? format(new Date(member.join_date as string), "MMM yyyy") : "N/A";
  doc.text(joinDate, detailsX + 25, detailsY);

  detailsY += 4;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("Status", detailsX, detailsY);
  
  doc.setFontSize(7);
  doc.setTextColor(20, 120, 40); // Green for active
  doc.text((member.status || "Active").toUpperCase(), detailsX + 25, detailsY);

  // Footer / Signature Area
  doc.setTextColor(...NAVY);
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signature", width - 5, height - 5, { align: "right" });
  
  // Footer Gold Strip
  doc.setFillColor(...GOLD);
  doc.rect(0, height - 2, width, 2, "F");

  // Add QR Code at the bottom middle using a simple URL or string
  // Let's use a tiny image generator from a known service or just skip QR code for simplicity in jsPDF
  // Wait, the user asked for QR optional. I will skip it to keep the PDF generator purely offline and simple.

  doc.save(`${member.member_id}-Membership-Card.pdf`);
}
