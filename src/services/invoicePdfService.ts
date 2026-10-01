const PDFDocument = require("pdfkit");

const colors = {
  ink: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  soft: "#F8FAFC",
  brand: "#10B981",
  brandDark: "#047857",
  white: "#FFFFFF",
};

function formatMoney(amountMinor, currency) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amountMinor || 0) / 100);
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function labelValue(doc, label, value, x, y, width = 220) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(colors.muted).text(label.toUpperCase(), x, y, { width, characterSpacing: 0.7 });
  doc.font("Helvetica").fontSize(10).fillColor(colors.ink).text(value || "-", x, y + 14, { width });
}

function tableHeader(doc, y) {
  doc.roundedRect(48, y, 499, 28, 4).fill(colors.ink);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(colors.white);
  doc.text("DESCRIPTION", 60, y + 10, { width: 260 });
  doc.text("QTY", 335, y + 10, { width: 45, align: "right" });
  doc.text("UNIT PRICE", 390, y + 10, { width: 70, align: "right" });
  doc.text("AMOUNT", 470, y + 10, { width: 65, align: "right" });
  return y + 36;
}

function addPageHeader(doc, invoiceNumber) {
  doc.font("Helvetica-Bold").fontSize(13).fillColor(colors.ink).text("HOSPITALIA", 48, 34);
  doc.font("Helvetica").fontSize(8).fillColor(colors.muted).text(`Invoice ${invoiceNumber}`, 350, 36, { width: 197, align: "right" });
  doc.moveTo(48, 56).lineTo(547, 56).strokeColor(colors.line).stroke();
}

function ensureSpace(doc, y, required, invoiceNumber, withTableHeader = true) {
  if (y + required <= 745) return y;
  doc.addPage();
  addPageHeader(doc, invoiceNumber);
  return withTableHeader ? tableHeader(doc, 76) : 76;
}

async function renderInvoicePdf({ invoice, tenant, subscription, payments, generatedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: {
      Title: `Invoice ${invoice.invoiceNumber}`,
      Author: "Hospitalia SaaS Platform",
      Subject: `Subscription invoice for ${tenant.displayName}`,
      CreationDate: generatedAt,
    } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.rect(0, 0, 595.28, 126).fill(colors.ink);
    doc.roundedRect(48, 35, 42, 42, 10).fill(colors.brand);
    doc.font("Helvetica-Bold").fontSize(20).fillColor(colors.ink).text("H", 60, 46, { width: 18, align: "center" });
    doc.font("Helvetica-Bold").fontSize(17).fillColor(colors.white).text("HOSPITALIA", 104, 39);
    doc.font("Helvetica").fontSize(8).fillColor("#CBD5E1").text("SAAS PLATFORM", 104, 61, { characterSpacing: 1.5 });
    doc.font("Helvetica-Bold").fontSize(28).fillColor(colors.white).text("INVOICE", 360, 39, { width: 187, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#CBD5E1").text(invoice.invoiceNumber, 330, 75, { width: 217, align: "right" });

    doc.roundedRect(48, 100, 499, 52, 8).fill(colors.brand);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text("AMOUNT DUE", 64, 113);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(colors.ink).text(formatMoney(invoice.balanceDueMinor, invoice.currency), 64, 128);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text(invoice.status, 390, 119, { width: 140, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor(colors.brandDark).text(`Generated ${formatDate(generatedAt)}`, 350, 134, { width: 180, align: "right" });

    doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.brandDark).text("BILLED BY", 48, 184, { characterSpacing: 0.8 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(colors.ink).text("Hospitalia SaaS Platform", 48, 202);
    doc.font("Helvetica").fontSize(9).fillColor(colors.muted).text("Subscription software services", 48, 221);

    doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.brandDark).text("BILL TO", 320, 184, { characterSpacing: 0.8 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(colors.ink).text(tenant.legalName || tenant.displayName, 320, 202, { width: 227 });
    const customerLines = [tenant.owner?.name, tenant.owner?.email, tenant.owner?.phone, tenant.primaryDomain].filter(Boolean).join("\n");
    doc.font("Helvetica").fontSize(9).fillColor(colors.muted).text(customerLines || tenant.slug, 320, 221, { width: 227, lineGap: 2 });

    doc.moveTo(48, 285).lineTo(547, 285).strokeColor(colors.line).stroke();
    labelValue(doc, "Invoice date", formatDate(invoice.issuedAt || invoice.createdAt), 48, 302, 105);
    labelValue(doc, "Due date", formatDate(invoice.dueAt), 178, 302, 105);
    labelValue(doc, "Billing period", `${formatDate(subscription?.currentPeriodStart)} - ${formatDate(subscription?.currentPeriodEnd)}`, 308, 302, 239);

    let y = tableHeader(doc, 354);
    for (const item of invoice.lineItems || []) {
      const rowHeight = Math.max(32, doc.heightOfString(item.description, { width: 260 }) + 16);
      y = ensureSpace(doc, y, rowHeight, invoice.invoiceNumber);
      if ((Math.round(y) % 2) === 0) doc.rect(48, y - 5, 499, rowHeight).fill(colors.soft);
      doc.font("Helvetica").fontSize(9).fillColor(colors.ink).text(item.description, 60, y + 5, { width: 260 });
      doc.text(String(item.quantity), 335, y + 5, { width: 45, align: "right" });
      doc.text(formatMoney(item.unitAmountMinor, invoice.currency), 390, y + 5, { width: 70, align: "right" });
      doc.font("Helvetica-Bold").text(formatMoney(item.totalMinor, invoice.currency), 470, y + 5, { width: 65, align: "right" });
      doc.moveTo(48, y + rowHeight - 5).lineTo(547, y + rowHeight - 5).strokeColor(colors.line).stroke();
      y += rowHeight;
    }

    y = ensureSpace(doc, y + 10, 155, invoice.invoiceNumber, false);
    const totalsX = 330;
    const amountX = 445;
    const totalRow = (label, amount, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9).fillColor(bold ? colors.ink : colors.muted).text(label, totalsX, y, { width: 105 });
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9).fillColor(colors.ink).text(formatMoney(amount, invoice.currency), amountX, y, { width: 90, align: "right" });
      y += bold ? 26 : 20;
    };
    totalRow("Subtotal", invoice.subtotalMinor);
    totalRow("Discount", -Number(invoice.discountMinor || 0));
    totalRow("Tax", invoice.taxMinor);
    doc.moveTo(totalsX, y - 4).lineTo(535, y - 4).strokeColor(colors.line).stroke();
    totalRow("Total", invoice.totalMinor, true);
    totalRow("Paid", invoice.amountPaidMinor);
    doc.roundedRect(totalsX - 8, y - 7, 213, 32, 5).fill(colors.soft);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(colors.ink).text("Balance due", totalsX, y + 3, { width: 105 });
    doc.text(formatMoney(invoice.balanceDueMinor, invoice.currency), amountX, y + 3, { width: 90, align: "right" });
    y += 47;

    if (payments.length) {
      y = ensureSpace(doc, y + 10, 75 + payments.length * 22, invoice.invoiceNumber, false);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(colors.ink).text("VERIFIED PAYMENT HISTORY", 48, y);
      y += 22;
      for (const payment of payments) {
        doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted).text(`${formatDate(payment.verifiedAt || payment.receivedAt)}  |  ${payment.method}  |  ${payment.providerReference || "No reference"}`, 48, y, { width: 370 });
        doc.font("Helvetica-Bold").fillColor(colors.ink).text(formatMoney(payment.amountMinor, payment.currency), 445, y, { width: 90, align: "right" });
        y += 20;
      }
    }

    y = ensureSpace(doc, y + 18, 45, invoice.invoiceNumber, false);
    doc.font("Helvetica").fontSize(8).fillColor(colors.muted).text("This invoice was generated from the current Hospitalia billing record at download time.", 48, y, { width: 499, align: "center" });

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      doc.font("Helvetica").fontSize(7.5).fillColor("#94A3B8").text(`Hospitalia SaaS Platform  |  ${invoice.invoiceNumber}  |  Page ${index + 1} of ${range.count}`, 48, 780, { width: 499, align: "center" });
    }
    doc.end();
  });
}

module.exports = { renderInvoicePdf };
