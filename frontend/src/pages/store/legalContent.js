/* Legal / policy content for the MuscleGrid storefront.
   Written to be strongly merchant-protective while staying within India's Consumer Protection
   Act 2019, the Consumer Protection (E-Commerce) Rules 2020, the DPDP Act 2023 and Razorpay's
   merchant policy requirements (one-sided policies that deny statutory refund rights get the
   payment account flagged — so every protective clause is paired with the mandatory statutory
   carve-out). Service model is PICKUP -> REPAIR -> RETURN (reverse pickup); we never describe a
   home technician visit. Each doc carries its own SEO title + meta description. */

export const COMPANY = {
  legalName: 'MuscleGrid India Private Limited',
  brand: 'MuscleGrid',
  short: 'MGIPL',
  gstin: '07AATCM1213F1ZM',
  address: '24 B2, Neb Sarai, New Delhi – 110068, India',
  email: 'founder@musclegrid.in',
  phone: '+91 95603 77363',
  site: 'https://store.musclegrid.in',
  grievanceOfficer: 'Grievance Officer, MuscleGrid India Private Limited',
};

const C = COMPANY;
const EFF = '3 July 2026';

// A doc = { slug, nav, title, seoTitle, seoDescription, updated, intro, sections[] }
// section = { h, body[] }; a body item is a string (paragraph) or { list: [...] } or { sub: '...' }.

export const LEGAL_DOCS = {
  /* ------------------------------------------------------------------ TERMS */
  terms: {
    slug: 'terms',
    nav: 'Terms & Conditions',
    title: 'Terms & Conditions',
    seoTitle: 'Terms & Conditions | MuscleGrid Official Store',
    seoDescription:
      'Terms & Conditions of sale for MuscleGrid solar inverters, lithium & inverter batteries and voltage stabilizers purchased at store.musclegrid.in. Read before you buy.',
    updated: EFF,
    intro:
      `These Terms & Conditions ("Terms") govern your access to and use of ${C.site} (the "Website") and the ` +
      `purchase of any product from ${C.legalName} ("${C.brand}", "we", "us" or "our"). By browsing the Website, ` +
      `creating an order or completing a purchase, you confirm that you are at least 18 years of age and that you ` +
      `have read, understood and agree to be bound by these Terms. If you do not agree, please do not use the Website.`,
    sections: [
      { h: '1. Definitions', body: [
        { list: [
          '"Product" means any goods offered for sale on the Website, including solar inverters, hybrid inverters, lithium and inverter batteries, voltage stabilizers, solar panels and related accessories.',
          '"Order" means your offer to purchase a Product on these Terms.',
          '"Customer", "you" or "your" means the person placing an Order or using the Website.',
        ] },
      ] },
      { h: '2. Orders and Acceptance', body: [
        'All Orders are an offer by you to purchase a Product subject to these Terms. No Order is binding on us until we accept it. We may, at our sole discretion and without liability, decline, cancel or limit any Order — including after payment — where the Product is unavailable or mispriced, where we suspect fraud, abuse, resale or a breach of these Terms, where delivery is not serviceable, or where required information is incomplete or inaccurate.',
        'Where we cancel a paid Order that we do not accept, your sole remedy is a refund of the amount paid for that Order, processed to the original payment method. We are not liable for any further loss.',
      ] },
      { h: '3. Pricing, Errors and Taxes', body: [
        'All prices are in Indian Rupees (INR) and are inclusive of GST unless stated otherwise. Prices, offers, specifications and availability may change at any time without notice.',
        'Despite our best efforts, a Product may occasionally be mispriced or its description may contain an error. Where a Product’s correct price is higher than the price shown, we may, before dispatch, either seek your confirmation of the correct price or cancel the Order and refund you in full. We are not obliged to sell a Product at an incorrect price.',
      ] },
      { h: '4. Product Information', body: [
        'Product images, specifications, capacities, backup figures and colours are indicative and for general guidance only. Actual performance (including battery backup, runtime and solar generation) depends on load, usage pattern, installation, environment, grid conditions and maintenance, and may vary. Such variation is not a defect and does not entitle you to a return or refund.',
        'You are responsible for selecting a Product suitable for your requirements, load and site conditions, and for ensuring compatibility with your existing equipment before purchase.',
      ] },
      { h: '5. Payment', body: [
        'Payment is processed through our third-party payment gateway (Razorpay). We do not store your card, UPI or bank credentials. By paying online you agree to the payment gateway’s terms. Cash on Delivery ("COD"), where offered, may be subject to serviceability, order value limits and verification, and may be withdrawn for any Order at our discretion.',
        'Title to a Product passes to you only on full receipt of payment; risk passes to you on delivery (see the Shipping & Delivery Policy).',
      ] },
      { h: '6. Installation and Correct Use', body: [
        'Unless expressly included in your Order, installation is not part of the sale. Products such as inverters, batteries and stabilizers must be installed, connected, earthed and operated strictly in accordance with the product manual and applicable safety norms, by a suitably qualified person.',
        'Incorrect installation or wiring, wrong sizing, overloading, use outside rated parameters, or connection to an unstable or unearthed supply may damage the Product and will void the warranty. We are not responsible for any such damage or for any consequential loss.',
      ] },
      { h: '7. Warranty', body: [
        `Products carry the manufacturer’s / ${C.brand} limited warranty stated on the product page or warranty card. Warranty service is provided on a pickup–repair–return basis as described in our Warranty & Service Policy, which forms part of these Terms. Except for that express limited warranty, and to the maximum extent permitted by law, all other warranties, conditions and representations, whether express or implied, are excluded.`,
      ] },
      { h: '8. Returns and Cancellation', body: [
        'Returns, replacements and cancellations are governed solely by our Return, Refund & Cancellation Policy, which forms part of these Terms. Products are not returnable merely because of a change of mind.',
      ] },
      { h: '9. Limitation of Liability', body: [
        'To the maximum extent permitted by applicable law, our total aggregate liability arising out of or in connection with any Product or Order, whether in contract, tort (including negligence), under statute or otherwise, shall not exceed the price actually paid by you for that Product.',
        'We shall not be liable for any indirect, incidental, special, punitive or consequential loss, or for any loss of profit, revenue, business, goodwill, data, or for loss or damage caused by power fluctuation, downtime, or by installation or use of the Product, however arising.',
        'Nothing in these Terms excludes or limits any liability that cannot lawfully be excluded or limited, including your rights under the Consumer Protection Act, 2019.',
      ] },
      { h: '10. Indemnity', body: [
        'You agree to indemnify and hold harmless MuscleGrid, its directors, employees and agents from and against any claim, loss, liability or expense arising out of your breach of these Terms, your misuse of a Product, or your violation of any law or third-party right.',
      ] },
      { h: '11. Intellectual Property', body: [
        'All content on the Website — including the MuscleGrid name, logo, product designs, text, graphics and images — is owned by or licensed to us and is protected by law. You may not copy, reproduce or use it without our prior written consent.',
      ] },
      { h: '12. Force Majeure', body: [
        'We are not liable for any delay or failure to perform caused by events beyond our reasonable control, including acts of God, natural disaster, epidemic, strike, transport or courier disruption, supplier failure, power or network outage, or government action.',
      ] },
      { h: '13. Governing Law and Dispute Resolution', body: [
        'These Terms are governed by the laws of India. Any dispute shall first be attempted to be resolved amicably. Failing that, the dispute shall be referred to arbitration by a sole arbitrator appointed by us under the Arbitration and Conciliation Act, 1996; the seat and venue of arbitration shall be New Delhi and the language shall be English.',
        'Subject to the arbitration clause above, the courts at New Delhi shall have exclusive jurisdiction. This clause does not affect any right you may have to approach a consumer forum under applicable law.',
      ] },
      { h: '14. Changes to these Terms', body: [
        'We may update these Terms at any time. The version in force at the time of your Order applies to that Order. Continued use of the Website after changes constitutes acceptance of the revised Terms.',
      ] },
      { h: '15. Contact', body: [
        `Questions about these Terms may be sent to ${C.email} or ${C.phone}. Registered office: ${C.address}. GSTIN: ${C.gstin}.`,
      ] },
    ],
  },

  /* ---------------------------------------------------------------- PRIVACY */
  privacy: {
    slug: 'privacy',
    nav: 'Privacy Policy',
    title: 'Privacy Policy',
    seoTitle: 'Privacy Policy | MuscleGrid Official Store',
    seoDescription:
      'How MuscleGrid collects, uses and protects your personal data when you shop at store.musclegrid.in. DPDP Act 2023 compliant. We never sell your data.',
    updated: EFF,
    intro:
      `${C.legalName} ("${C.brand}", "we", "us") respects your privacy. This Privacy Policy explains what personal ` +
      `data we collect when you use ${C.site}, how we use it, whom we share it with and the choices you have. We ` +
      `handle personal data in accordance with applicable Indian law, including the Digital Personal Data Protection Act, 2023.`,
    sections: [
      { h: '1. Information We Collect', body: [
        { list: [
          'Identity & contact data: name, phone number, email address and delivery address you provide at checkout.',
          'Order & transaction data: products ordered, amounts, GSTIN (for GST invoices), order history and communications with us.',
          'Payment data: processed directly by our payment gateway (Razorpay). We receive confirmation of payment but do not collect or store your full card, UPI or bank details.',
          'Technical data: IP address, device and browser information, and basic usage data collected automatically to operate and secure the Website.',
        ] },
      ] },
      { h: '2. How We Use Your Information', body: [
        { list: [
          'To process, fulfil, ship and invoice your Orders and provide pickup–repair–return warranty service.',
          'To communicate with you about your Order, delivery, service requests and support.',
          'To comply with tax, accounting and other legal obligations.',
          'To prevent fraud and misuse and to secure the Website.',
          'With your consent, to send you offers and updates (you may opt out at any time).',
        ] },
      ] },
      { h: '3. Sharing of Information', body: [
        'We share personal data only as necessary: with logistics and courier partners to deliver your Order and arrange pickups; with our payment gateway to process payments; with professional advisers, and with government or regulatory authorities where required by law. We do not sell or rent your personal data to anyone.',
      ] },
      { h: '4. Data Retention', body: [
        'We retain personal data for as long as needed to fulfil the purposes above and to meet legal, tax and accounting requirements, after which it is deleted or anonymised.',
      ] },
      { h: '5. Cookies', body: [
        'The Website uses cookies and similar technologies to keep your cart, remember preferences and understand usage. You can control cookies through your browser settings; disabling them may affect Website functionality.',
      ] },
      { h: '6. Data Security', body: [
        'We use reasonable technical and organisational measures to protect personal data. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
      ] },
      { h: '7. Your Rights', body: [
        'Subject to applicable law, you may request access to, correction of, or deletion of your personal data, and may withdraw consent to marketing. To exercise these rights, contact us using the details below. We may need to verify your identity before acting on a request.',
      ] },
      { h: '8. Children', body: [
        'The Website is intended for users aged 18 and above. We do not knowingly collect data from children.',
      ] },
      { h: '9. Grievance Officer', body: [
        `In accordance with applicable law, our Grievance Officer can be reached at: ${C.grievanceOfficer}, ${C.address}. Email: ${C.email}. Phone: ${C.phone}. We aim to acknowledge grievances within 48 hours and resolve them within the time prescribed by law.`,
      ] },
      { h: '10. Changes', body: [
        'We may update this Privacy Policy from time to time. The current version is always available on this page.',
      ] },
    ],
  },

  /* ---------------------------------------------------------- RETURNS/REFUND */
  returns: {
    slug: 'returns',
    nav: 'Returns & Refunds',
    title: 'Return, Refund & Cancellation Policy',
    seoTitle: 'Return, Refund & Cancellation Policy | MuscleGrid Official Store',
    seoDescription:
      'MuscleGrid return, refund and cancellation policy: report transit damage within 48 hours with an unboxing video, defect verification, refund timelines and exclusions.',
    updated: EFF,
    intro:
      `This Return, Refund & Cancellation Policy explains when a Product bought at ${C.site} can be cancelled, ` +
      `returned or refunded. It is designed to be fair while protecting both parties against misuse. It forms part of ` +
      `our Terms & Conditions.`,
    sections: [
      { h: '1. Order Cancellation', body: [
        'You may request cancellation of an Order before it is dispatched by contacting us with your order number. Once a Product has been dispatched, it cannot be cancelled and will be treated under the return conditions below. Prepaid Orders cancelled before dispatch are refunded in full to the original payment method.',
      ] },
      { h: '2. Damaged or Wrong Item on Delivery', body: [
        'We pack every Product carefully. If a Product arrives visibly damaged in transit, or you receive a wrong or incomplete item, you must:',
        { list: [
          'Report it to us within 48 hours of delivery, and',
          'Provide a clear, continuous unboxing video that starts before the sealed package is opened and clearly shows the sealed packaging, all labels and the damage or discrepancy.',
        ] },
        'The unboxing video is mandatory for any transit-damage, wrong-item or missing-item claim. Claims without a valid unboxing video, or reported after 48 hours, cannot be accepted. This requirement protects genuine customers and prevents false claims.',
      ] },
      { h: '3. Dead-on-Arrival (DOA) / Manufacturing Defect', body: [
        'If a Product does not power on or is found to have a genuine manufacturing defect, report it within 48 hours of delivery with the unboxing video and a description of the issue. On our verification, the Product will be repaired, replaced or refunded at our discretion, in that order of preference. Verification may require the Product to be picked up and inspected before a decision.',
      ] },
      { h: '4. Change of Mind', body: [
        'Products are not returnable for change of mind, or because backup, runtime or generation differs from your expectation (see clause 4 of the Terms). We do not offer "no-questions-asked" returns.',
      ] },
      { h: '5. Conditions for an Approved Return', body: [
        { list: [
          'The return must be pre-approved by us; do not ship anything back without a return authorisation.',
          'The Product must be unused, uninstalled and in its original condition, with all original packaging, accessories, cables, manuals, warranty card and free items intact.',
          'Products that have been installed, wired, used, physically damaged after delivery, or tampered with are not eligible for return except under the warranty.',
          'Approved change-of-configuration or discretionary returns may be subject to a restocking fee of up to 15% plus the actual to-and-fro logistics cost.',
        ] },
      ] },
      { h: '6. Non-Returnable Items', body: [
        'Consumables, installed or used items, made-to-order or custom-configured items, and items marked non-returnable on the product page are not eligible for return except where they fail under warranty.',
      ] },
      { h: '7. Refunds', body: [
        'Approved refunds are made only to the original payment method. Once approved, refunds are initiated within 2 business days and typically reflect within 5–7 business days depending on your bank or payment provider. For COD Orders, refunds are made to a bank account you verify. Shipping charges and any restocking or logistics costs are non-refundable except where the return is due to our error or a verified defect.',
      ] },
      { h: '8. How to Raise a Request', body: [
        `Email ${C.email} or call/WhatsApp ${C.phone} with your order number, a description of the issue and the unboxing video (where applicable). Our team will guide you through the pickup and resolution process.`,
      ] },
      { h: '9. Statutory Rights', body: [
        'Nothing in this policy limits any right you have that cannot be excluded under the Consumer Protection Act, 2019 or other applicable law.',
      ] },
    ],
  },

  /* --------------------------------------------------------------- SHIPPING */
  shipping: {
    slug: 'shipping',
    nav: 'Shipping & Delivery',
    title: 'Shipping & Delivery Policy',
    seoTitle: 'Shipping & Delivery Policy | MuscleGrid Official Store',
    seoDescription:
      'MuscleGrid shipping and delivery policy: serviceable pincodes, dispatch and delivery timelines, charges, and how to report transit damage with an unboxing video.',
    updated: EFF,
    intro:
      `This Shipping & Delivery Policy explains how Products bought at ${C.site} are dispatched and delivered across India.`,
    sections: [
      { h: '1. Serviceable Locations', body: [
        'We ship across India to pincodes serviced by our courier partners. You can check serviceability for your pincode on the product page or at checkout. Some remote or restricted locations may not be serviceable, or may attract additional time or charges.',
      ] },
      { h: '2. Dispatch and Delivery Timelines', body: [
        'Orders are usually dispatched within 1–3 business days of confirmation, subject to stock and verification. Typical delivery is 3–8 business days from dispatch depending on destination. All timelines are good-faith estimates only and are not guaranteed. Delays caused by couriers, weather, strikes, remote destinations or events beyond our control are not our responsibility.',
      ] },
      { h: '3. Shipping Charges', body: [
        'Shipping charges, if any, are shown at checkout before payment. Free shipping, where offered, applies only to serviceable standard-delivery locations and may exclude bulky items.',
      ] },
      { h: '4. Risk and Title', body: [
        'Risk in the Product passes to you upon delivery to the address provided (or to any person at that address who accepts the delivery). Please provide a complete, accurate address and a reachable phone number; re-delivery or address correction due to incorrect details may attract additional charges.',
      ] },
      { h: '5. Delivery Inspection and Transit Damage', body: [
        'Please inspect the package at delivery. If the outer packaging is visibly damaged or tampered, either refuse the delivery or accept it and report the issue to us within 48 hours with a valid unboxing video (see the Return, Refund & Cancellation Policy). Transit-damage claims without an unboxing video or reported after 48 hours cannot be accepted.',
      ] },
      { h: '6. Failed Delivery', body: [
        'If a delivery fails because you are unreachable, refuse acceptance without valid reason, or provide an incorrect address, the Product may be returned to us. Re-shipping may attract additional charges, and for prepaid Orders we may refund the Product value after deducting to-and-fro logistics costs.',
      ] },
      { h: '7. Warranty Pickups', body: [
        'For warranty service we arrange a reverse pickup of the Product from your address; see the Warranty & Service Policy for details.',
      ] },
    ],
  },

  /* -------------------------------------------------------------- WARRANTY */
  warranty: {
    slug: 'warranty',
    nav: 'Warranty & Service',
    title: 'Warranty & Service Policy',
    seoTitle: 'Warranty & Service Policy | MuscleGrid Official Store',
    seoDescription:
      'MuscleGrid warranty and service policy for inverters, batteries and stabilizers. Hassle-free pickup, repair and return service across India. Warranty terms and exclusions.',
    updated: EFF,
    intro:
      `${C.brand} stands behind its Products with a straightforward, hassle-free service promise. This Warranty & ` +
      `Service Policy explains what is covered, what is not, and how our pickup–repair–return service works. It ` +
      `forms part of our Terms & Conditions.`,
    sections: [
      { h: '1. Warranty Coverage', body: [
        'Each Product is covered by the limited warranty stated on its product page or warranty card, against genuine manufacturing defects in materials and workmanship under normal use, for the stated warranty period from the date of delivery. Keep your invoice — it is your proof of warranty.',
      ] },
      { h: '2. How Our Service Works — Pickup, Repair, Return', body: [
        'We make service simple and contactless. If your Product develops a covered fault during the warranty period:',
        { list: [
          `Raise a service request at ${C.email} or ${C.phone} with your order number and a description of the issue.`,
          'Our team runs a quick guided check to resolve simple issues remotely where possible.',
          'If the Product needs workshop attention, we arrange a reverse pickup of the Product from your address through our courier partner — you do not need to travel or arrange transport.',
          'Our technicians inspect and repair the Product at our service facility, and we ship the repaired or replaced Product back to you.',
        ] },
        'We do not carry out in-home repairs; all warranty work is performed at our service facility to ensure proper testing and quality. This pickup–repair–return process applies across all serviceable locations in India.',
      ] },
      { h: '3. Turnaround', body: [
        'We aim to complete warranty service as quickly as possible. Actual turnaround depends on the fault, part availability and your location, and any timeline we share is an estimate, not a guarantee. Where a repair is not viable, we may replace the Product or a component at our discretion.',
      ] },
      { h: '4. What Is Not Covered', body: [
        'The warranty does not cover, and we are not liable for, any of the following:',
        { list: [
          'Physical damage, mishandling, drops, spillage, water or moisture ingress, fire, rodent or pest damage.',
          'Damage from incorrect installation, wrong wiring, poor earthing, wrong sizing, overloading, or use outside rated parameters.',
          'Damage from power surges, voltage fluctuation, lightning, or an unstable/unearthed supply.',
          'Normal wear and tear, consumables, and gradual reduction in battery capacity consistent with normal ageing and usage.',
          'Products with a removed, altered or unreadable serial number, or opened, tampered with or repaired by anyone not authorised by us.',
          'Any defect arising from negligence, misuse, accident, or use not in accordance with the product manual.',
        ] },
      ] },
      { h: '5. Warranty Void Conditions', body: [
        'The warranty is void if the Product is opened, modified or repaired by an unauthorised person, if the serial number is tampered with, or if the fault is caused by any of the exclusions in clause 4.',
      ] },
      { h: '6. Out-of-Warranty and Chargeable Service', body: [
        'For Products outside the warranty period, or for faults not covered by warranty, we may offer paid repair on the same pickup–repair–return basis. We will share an estimate for your approval before proceeding; pickup, inspection, parts and return charges may apply.',
      ] },
      { h: '7. Limitation', body: [
        'Our liability under this Warranty & Service Policy is limited to the repair or replacement of the Product, or at our discretion a refund not exceeding the price paid, as set out in the Terms & Conditions. Nothing here limits rights that cannot be excluded under applicable law.',
      ] },
    ],
  },

  /* ---------------------------------------------------------------- CONTACT */
  contact: {
    slug: 'contact',
    nav: 'Contact Us',
    title: 'Contact Us',
    seoTitle: 'Contact MuscleGrid | Support, Service & Sales',
    seoDescription:
      'Contact MuscleGrid for orders, warranty pickup-repair-return service and support. Email, phone/WhatsApp and registered office details for MuscleGrid India Pvt Ltd.',
    updated: EFF,
    intro:
      `We’re here to help with orders, delivery, warranty service and general questions. Reach the ${C.brand} team ` +
      `using the details below and we’ll get back to you as quickly as we can.`,
    sections: [
      { h: 'Customer Support', body: [
        { list: [
          `Email: ${C.email}`,
          `Phone / WhatsApp: ${C.phone}`,
          'Support hours: Monday to Saturday, 10:00 AM to 7:00 PM IST (excluding public holidays).',
        ] },
      ] },
      { h: 'Registered Office', body: [
        `${C.legalName}`,
        `${C.address}`,
        `GSTIN: ${C.gstin}`,
      ] },
      { h: 'Warranty & Service', body: [
        'For any service need, email or WhatsApp us with your order number and a short description of the issue. We provide hassle-free pickup–repair–return service across serviceable locations in India — see our Warranty & Service Policy.',
      ] },
      { h: 'Grievance Redressal', body: [
        `If you are not satisfied with a resolution, you may write to our Grievance Officer at ${C.email} (subject line: "Grievance"). We aim to acknowledge within 48 hours and resolve as quickly as possible in accordance with applicable law.`,
      ] },
    ],
  },
};

// Footer / navigation order.
export const LEGAL_ORDER = ['terms', 'privacy', 'returns', 'shipping', 'warranty', 'contact'];
