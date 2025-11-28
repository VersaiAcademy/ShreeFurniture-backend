const currency = (value) => {
  if (typeof value !== 'number') {
    const num = Number(value);
    if (!Number.isFinite(num)) return 'N/A';
    return `₹${num.toLocaleString('en-IN')}`;
  }
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

const renderItemRows = (items = []) => {
  if (!items.length) {
    return `<tr>
      <td colspan="4" style="padding:12px;border:1px solid #eee;text-align:center;color:#6b7280;font-size:13px;">
        No item breakdown provided
      </td>
    </tr>`;
  }

  return items
    .map(
      (item) => `<tr>
        <td style="padding:12px;border:1px solid #eee;">${item.productName || 'Product'}</td>
        <td style="padding:12px;border:1px solid #eee;text-align:center;">${item.quantity || 1}</td>
        <td style="padding:12px;border:1px solid #eee;text-align:right;">${currency(item.price)}</td>
        <td style="padding:12px;border:1px solid #eee;text-align:right;">${currency(
          (item.price || 0) * (item.quantity || 1)
        )}</td>
      </tr>`
    )
    .join('');
};

const baseLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Order Notification</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#111827;padding:32px 24px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;">SRI Furniture Village</h1>
                <p style="color:#cbd5f5;margin:8px 0 0;font-size:14px;">Premium handcrafted furniture</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;color:#111827;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="background:#f9fafb;padding:20px;text-align:center;color:#6b7280;font-size:12px;">
                © ${new Date().getFullYear()} SRI Furniture Village. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const addressBlock = (order) => {
  const rows = [
    order.address,
    [order.city, order.state].filter(Boolean).join(', '),
    order.pincode && `Pincode: ${order.pincode}`
  ]
    .filter(Boolean)
    .map((line) => `<p style="margin:0;color:#374151;">${line}</p>`)
    .join('');

  return `
    <div style="background:#fef3c7;padding:18px;border-radius:10px;margin-top:18px;">
      <p style="margin:0;font-weight:bold;color:#92400e;text-transform:uppercase;font-size:12px;">Delivery Address</p>
      <p style="margin:6px 0 0;color:#1f2937;">${rows || 'Not provided'}</p>
    </div>
  `;
};

exports.buildCustomerOrderEmail = (order) => {
  const deliveryMessage = order.paymentStatus === 'paid' || order.paymentStatus === 'success'
    ? 'Your payment has been confirmed. We will process your order immediately.'
    : order.paymentMode === 'cod'
    ? 'Your order will be processed and delivered. Payment will be collected on delivery.'
    : 'Your order is being processed. Please complete payment to confirm.';

  const content = `
    <p style="font-size:18px;margin:0 0 8px;color:#111827;font-weight:bold;">Hello ${order.name || 'Customer'},</p>
    <p style="font-size:16px;margin:0 0 20px;color:#059669;font-weight:bold;">✅ Order Confirmed!</p>
    
    <p style="font-size:14px;margin:0 0 16px;color:#4b5563;">
      Thank you for choosing <strong>SRI Furniture Village</strong>. Your order has been received and confirmed.
    </p>

    <div style="background:#f0fdf4;border:2px solid #10b981;padding:20px;border-radius:10px;margin-bottom:20px;">
      <p style="margin:0 0 8px;color:#065f46;font-size:14px;font-weight:bold;">📦 Order ID: <span style="color:#111827;">${order.orderId}</span></p>
      <p style="margin:0;color:#065f46;font-size:13px;">${deliveryMessage}</p>
    </div>

    <div style="background:#f1f5f9;padding:18px;border-radius:10px;margin-bottom:18px;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Order Details</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#64748b;"><strong>Product:</strong></td>
          <td style="padding:8px 0;color:#111827;text-align:right;">${order.productName || 'Custom Furniture'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;"><strong>Total Amount:</strong></td>
          <td style="padding:8px 0;color:#111827;text-align:right;font-weight:bold;font-size:16px;">${currency(order.productPrice || order.total || 0)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;"><strong>Payment Mode:</strong></td>
          <td style="padding:8px 0;color:#111827;text-align:right;">${order.paymentMode?.toUpperCase() || 'NA'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;"><strong>Payment Status:</strong></td>
          <td style="padding:8px 0;color:#111827;text-align:right;">${order.paymentStatus?.toUpperCase() || 'PENDING'}</td>
        </tr>
      </table>
    </div>

    ${order.cartItems?.length ? `
      <div style="margin-bottom:18px;">
        <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Order Items</h3>
        <table width="100%" style="border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:12px;border:1px solid #e5e7eb;text-align:left;">Item</th>
              <th style="padding:12px;border:1px solid #e5e7eb;text-align:center;">Qty</th>
              <th style="padding:12px;border:1px solid #e5e7eb;text-align:right;">Price</th>
              <th style="padding:12px;border:1px solid #e5e7eb;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderItemRows(order.cartItems)}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${addressBlock(order)}

    <div style="background:#fef3c7;padding:18px;border-radius:10px;margin-top:20px;border-left:4px solid #f59e0b;">
      <p style="margin:0 0 8px;color:#92400e;font-weight:bold;font-size:14px;">📅 Estimated Delivery</p>
      <p style="margin:0;color:#78350f;font-size:13px;">
        Our team will contact you within 24-48 hours to schedule delivery. Expected delivery: 5-7 business days.
      </p>
    </div>

    <p style="margin:24px 0 0;color:#111827;font-size:14px;line-height:1.6;">
      If you have any questions or need to modify your order, please contact us at <strong>srifurniturevillageweb@gmail.com</strong> or reply to this email.
    </p>
    
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
      We appreciate your business and look forward to serving you!
    </p>
  `;

  return baseLayout(content);
};

exports.buildAdminOrderEmail = (order) => {
  const formTypeLabel = {
    'custom': 'Custom Furniture Enquiry',
    'bulk': 'Bulk/Corporate Order',
    'checkout': 'Regular Checkout Order',
    'cod': 'Cash on Delivery Order',
    'order': 'General Order'
  }[order.formType] || order.formType || 'Order';

  const content = `
    <div style="background:#fee2e2;border-left:4px solid #ef4444;padding:16px;margin-bottom:20px;">
      <p style="font-size:14px;color:#dc2626;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">🚨 NEW ORDER RECEIVED</p>
      <h2 style="margin:0;font-size:22px;color:#111827;">${order.name || 'Customer'}</h2>
      <p style="margin:4px 0 0;color:#991b1b;font-size:13px;">Type: ${formTypeLabel} | Order ID: <strong>${order.orderId}</strong></p>
    </div>

    <div style="background:#f9fafb;padding:18px;border-radius:10px;margin-bottom:18px;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Customer Information</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;width:40%;"><strong>Name:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;">${order.name || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Phone:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><a href="tel:${order.phone || ''}" style="color:#2563eb;">${order.phone || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><strong>Email:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><a href="mailto:${order.email || ''}" style="color:#2563eb;">${order.email || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Product:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">${order.productName || 'Custom Requirement'}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><strong>Total Amount:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;font-weight:bold;color:#059669;font-size:16px;">${currency(order.productPrice || order.total || 0)}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Payment Mode:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">${order.paymentMode?.toUpperCase() || 'NA'}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><strong>Payment Status:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;">
            <span style="padding:4px 12px;border-radius:4px;background:${
              order.paymentStatus === 'paid' || order.paymentStatus === 'success' ? '#d1fae5' :
              order.paymentStatus === 'cod' ? '#dbeafe' :
              '#fef3c7'
            };color:${
              order.paymentStatus === 'paid' || order.paymentStatus === 'success' ? '#065f46' :
              order.paymentStatus === 'cod' ? '#1e40af' :
              '#92400e'
            };font-weight:bold;">
              ${order.paymentStatus?.toUpperCase() || 'PENDING'}
            </span>
          </td>
        </tr>
      </table>
    </div>

    ${addressBlock(order)}

    ${
      order.cartItems?.length
        ? `<div style="margin-top:18px;">
            <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Order Items</h3>
            <table width="100%" style="border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:12px;border:1px solid #e5e7eb;text-align:left;">Item</th>
                  <th style="padding:12px;border:1px solid #e5e7eb;text-align:center;">Qty</th>
                  <th style="padding:12px;border:1px solid #e5e7eb;text-align:right;">Price</th>
                  <th style="padding:12px;border:1px solid #e5e7eb;text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${renderItemRows(order.cartItems)}
              </tbody>
            </table>
          </div>`
        : ''
    }

    ${
      order.notes
        ? `<div style="margin-top:18px;padding:16px;border-left:4px solid #f97316;background:#fff7ed;color:#78350f;border-radius:4px;">
            <p style="margin:0 0 8px;font-weight:bold;font-size:14px;">📝 Customer Note/Requirement:</p>
            <p style="margin:0;white-space:pre-line;font-size:13px;">${order.notes}</p>
          </div>`
        : ''
    }

    <div style="margin-top:20px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
      <p style="margin:0;color:#1e40af;font-size:13px;">
        <strong>Action Required:</strong> Please process this order and contact the customer to confirm delivery details.
      </p>
    </div>

    <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">
      Order received at: ${new Date(order.createdAt || Date.now()).toLocaleString('en-IN')}
    </p>
  `;

  return baseLayout(content);
};

// Contact Form Email Template
exports.buildContactFormEmail = (contactData) => {
  const content = `
    <div style="background:#fee2e2;border-left:4px solid #ef4444;padding:16px;margin-bottom:20px;">
      <p style="font-size:14px;color:#dc2626;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">📧 NEW CONTACT FORM SUBMISSION</p>
      <h2 style="margin:0;font-size:22px;color:#111827;">${contactData.name || 'Customer'}</h2>
    </div>

    <div style="background:#f9fafb;padding:18px;border-radius:10px;margin-bottom:18px;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Contact Information</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;width:40%;"><strong>Name:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;">${contactData.name || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Email:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><a href="mailto:${contactData.email || ''}" style="color:#2563eb;">${contactData.email || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><strong>Phone:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><a href="tel:${contactData.mob || ''}" style="color:#2563eb;">${contactData.mob || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Reason:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">${contactData.reason || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <div style="background:#fef3c7;padding:18px;border-radius:10px;margin-bottom:18px;border-left:4px solid #f59e0b;">
      <p style="margin:0 0 8px;color:#92400e;font-weight:bold;font-size:14px;">💬 Message:</p>
      <p style="margin:0;color:#78350f;font-size:14px;white-space:pre-line;line-height:1.6;">${contactData.message || 'No message provided'}</p>
    </div>

    ${contactData.img ? `
      <div style="margin-bottom:18px;">
        <p style="margin:0 0 8px;color:#111827;font-weight:bold;font-size:14px;">📎 Attachment:</p>
        <p style="margin:0;color:#4b5563;font-size:13px;">
          <a href="${contactData.img}" style="color:#2563eb;text-decoration:underline;">View Image</a>
        </p>
      </div>
    ` : ''}

    <div style="margin-top:20px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
      <p style="margin:0;color:#1e40af;font-size:13px;">
        <strong>Action Required:</strong> Please respond to this customer inquiry promptly.
      </p>
    </div>

    <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">
      Submitted at: ${new Date(contactData.createdAt || Date.now()).toLocaleString('en-IN')}
    </p>
  `;

  return baseLayout(content);
};

// Custom Furniture Enquiry Email Template
exports.buildCustomFurnitureEmail = (order) => {
  const content = `
    <div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:16px;margin-bottom:20px;">
      <p style="font-size:14px;color:#1e40af;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">🪑 CUSTOM FURNITURE ENQUIRY</p>
      <h2 style="margin:0;font-size:22px;color:#111827;">${order.name || 'Customer'}</h2>
      <p style="margin:4px 0 0;color:#1e3a8a;font-size:13px;">Order ID: <strong>${order.orderId}</strong></p>
    </div>

    <div style="background:#f9fafb;padding:18px;border-radius:10px;margin-bottom:18px;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Customer Details</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;width:40%;"><strong>Name:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;">${order.name || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Phone:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><a href="tel:${order.phone || ''}" style="color:#2563eb;">${order.phone || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><strong>Email:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><a href="mailto:${order.email || ''}" style="color:#2563eb;">${order.email || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Product:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">${order.productName || 'Custom Furniture Request'}</td>
        </tr>
      </table>
    </div>

    ${addressBlock(order)}

    ${order.notes ? `
      <div style="margin-top:18px;padding:16px;border-left:4px solid #f97316;background:#fff7ed;color:#78350f;border-radius:4px;">
        <p style="margin:0 0 8px;font-weight:bold;font-size:14px;">📝 Custom Requirements:</p>
        <p style="margin:0;white-space:pre-line;font-size:13px;">${order.notes}</p>
      </div>
    ` : ''}

    <div style="margin-top:20px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
      <p style="margin:0;color:#1e40af;font-size:13px;">
        <strong>Action Required:</strong> Contact customer to discuss custom furniture requirements and provide quote.
      </p>
    </div>
  `;

  return baseLayout(content);
};

// Bulk Order Email Template
exports.buildBulkOrderEmail = (order) => {
  const meta = order.meta || {};
  const content = `
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;margin-bottom:20px;">
      <p style="font-size:14px;color:#92400e;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">📦 BULK/CORPORATE ORDER ENQUIRY</p>
      <h2 style="margin:0;font-size:22px;color:#111827;">${order.name || 'Customer'}</h2>
      <p style="margin:4px 0 0;color:#78350f;font-size:13px;">Order ID: <strong>${order.orderId}</strong></p>
    </div>

    <div style="background:#f9fafb;padding:18px;border-radius:10px;margin-bottom:18px;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Business Information</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;width:40%;"><strong>Contact Name:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;">${order.name || 'N/A'}</td>
        </tr>
        ${meta.company ? `
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Company/Business:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">${meta.company}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#${meta.company ? 'ffffff' : 'f9fafb'};"><strong>Phone:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#${meta.company ? 'ffffff' : 'f9fafb'};"><a href="tel:${order.phone || ''}" style="color:#2563eb;">${order.phone || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Email:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><a href="mailto:${order.email || ''}" style="color:#2563eb;">${order.email || 'N/A'}</a></td>
        </tr>
        ${meta.requirementType ? `
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><strong>Requirement Type:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;">${meta.requirementType}</td>
        </tr>
        ` : ''}
        ${meta.quantity ? `
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Approx Quantity:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">${meta.quantity}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;"><strong>Product:</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#ffffff;">${order.productName || 'Bulk Order'}</td>
        </tr>
      </table>
    </div>

    ${addressBlock(order)}

    ${order.notes ? `
      <div style="margin-top:18px;padding:16px;border-left:4px solid #f97316;background:#fff7ed;color:#78350f;border-radius:4px;">
        <p style="margin:0 0 8px;font-weight:bold;font-size:14px;">📝 Requirements:</p>
        <p style="margin:0;white-space:pre-line;font-size:13px;">${order.notes}</p>
      </div>
    ` : ''}

    <div style="margin-top:20px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
      <p style="margin:0;color:#1e40af;font-size:13px;">
        <strong>Action Required:</strong> This is a bulk order enquiry. Contact customer to discuss pricing, customization, and delivery timeline.
      </p>
    </div>
  `;

  return baseLayout(content);
};



